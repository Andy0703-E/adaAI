import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { defaultProvider } from "@/lib/ai/openai-compatible";
import { aiConfig } from "@/lib/ai/config";
import { parseSSEStream } from "@/lib/ai/stream-parser";
import { authenticatedChatSchema, guestChatSchema } from "@/lib/validation/chat";
import { constructDocumentContext } from "@/lib/documents/context";
import { rateLimit } from "@/lib/rate-limit";
import { createErrorResponse } from "@/lib/utils/error-response";
import { logger } from "@/lib/logging/logger";
import { AIProviderException } from "@/lib/ai/errors";
import { ChatMessagePayload } from "@/types/ai";

export const dynamic = "force-dynamic";

import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai/constants";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  let authMs = 0;
  let redisMs = 0;
  let dbMs = 0;
  let providerConnectMs = 0;
  let firstReasoningMs: number | null = null;
  let firstContentMs: number | null = null;

  try {
    const authStart = performance.now();
    const session = await auth();
    authMs = Math.round(performance.now() - authStart);

    const userId = session?.user?.id;
    const isAuth = Boolean(userId);

    // Rate Limiting (before parsing expensive payload or initiating AI streaming)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rlStart = performance.now();
    const rl = await rateLimit({
      scope: "chat",
      userId: isAuth ? userId : undefined,
      ip: !isAuth ? clientIp : undefined,
    });
    redisMs = Math.round(performance.now() - rlStart);

    if (!rl.allowed) {
      if (rl.error === "REDIS_UNAVAILABLE") {
        return createErrorResponse(
          "REDIS_UNAVAILABLE",
          "Layanan percakapan sementara tidak tersedia. Silakan coba beberapa saat lagi.",
          undefined,
          503,
          undefined,
          requestId
        );
      }

      return Response.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Terlalu banyak permintaan chat. Coba lagi dalam ${rl.retryAfter} detik.`,
          requestId,
          retryAfter: rl.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter),
            "X-Request-Id": requestId,
          },
        }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse("VALIDATION_FAILED", "Format JSON tidak valid.", undefined, 400, undefined, requestId);
    }

    let conversationId: string | null = null;
    let modelId = body?.modelId || aiConfig.defaultModel;
    let messagesToSend: ChatMessagePayload[] = [];
    let assistantMessageId: string | null = null;
    let clientAborted = false;
    let assistantSeqNumber = 0;
    
    // Manage attachment linking payload globally across stream block
    let globalAttachmentIdsToUpdate: string[] = [];

    const clientSignal = req.signal;

    // 1. Authenticated User Flow
    if (isAuth && userId) {
      const parsed = authenticatedChatSchema.safeParse(body);
      if (!parsed.success) {
        return createErrorResponse("VALIDATION_FAILED", "Format pesan tidak valid.", parsed.error.format(), 400, undefined, requestId);
      }

      conversationId = parsed.data.conversationId;

      const dbStart = performance.now();
      // Verify conversation ownership
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        return createErrorResponse("NOT_FOUND", "Percakapan tidak ditemukan.", undefined, 404, undefined, requestId);
      }

      // Determine model
      modelId = parsed.data.modelId || conversation.modelId || aiConfig.defaultModel;

      // Load authoritative history from DB
      const existingMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { sequenceNo: "asc" },
      });

      const lastSeq = existingMessages.length > 0 ? existingMessages[existingMessages.length - 1].sequenceNo : 0;
      const userSeq = lastSeq + 1;
      const assistantSeq = lastSeq + 2;
      assistantSeqNumber = assistantSeq;

      // Save user message to database
      await prisma.message.create({
        data: {
          conversationId,
          sequenceNo: userSeq,
          role: "USER",
          content: parsed.data.content,
          status: "COMPLETED",
        },
      });

      // Create assistant placeholder message
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          sequenceNo: assistantSeq,
          role: "ASSISTANT",
          content: "",
          status: "PENDING",
          providerKey: defaultProvider.providerKey,
          modelId,
        },
      });
      assistantMessageId = assistantMessage.id;

      // Update conversation state to ACTIVE and bump lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: conversation.status === "DRAFT" ? "ACTIVE" : conversation.status,
          lastMessageAt: new Date(),
          modelId,
        },
      });

      // Build upstream prompt messages
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: session!.user!.id },
      });
      dbMs = Math.round(performance.now() - dbStart);

      const effectiveSystemPrompt =
        conversation.systemPrompt ||
        userSettings?.systemPrompt ||
        DEFAULT_SYSTEM_PROMPT;

      messagesToSend.push({ role: "system", content: effectiveSystemPrompt });

      // Handle Attachments
      let documentContext = "";

      if (parsed.data.attachmentIds && parsed.data.attachmentIds.length > 0) {
        if (parsed.data.attachmentIds.length > 3) {
          return createErrorResponse("DOCUMENT_TOO_MANY_FILES", "Maksimal 3 lampiran", undefined, 400, undefined, requestId);
        }

        // Deduplicate
        const uniqueIds = Array.from(new Set(parsed.data.attachmentIds));

        const attachments = await prisma.documentAttachment.findMany({
          where: {
            id: { in: uniqueIds },
            userId,
            conversationId,
            status: "READY", // MUST be READY, not ATTACHED or FAILED
            messageId: null
          },
        });

        if (attachments.length !== uniqueIds.length) {
          return createErrorResponse("DOCUMENT_ATTACHMENT_NOT_FOUND", "Satu atau lebih lampiran tidak valid, sudah terpakai, atau bukan milik Anda.", undefined, 403, undefined, requestId);
        }

        const documents = attachments.map(att => ({
           name: att.originalName,
           content: att.extractedText || "",
        }));

        documentContext = constructDocumentContext(documents);
        globalAttachmentIdsToUpdate = attachments.map(a => a.id);
      }

      for (const msg of existingMessages) {
        if (msg.status === "COMPLETED" || (msg.status === "CANCELLED" && msg.content)) {
          messagesToSend.push({
            role: msg.role === "USER" ? "user" : msg.role === "SYSTEM" ? "system" : "assistant",
            content: msg.content,
          });
        }
      }

      const finalUserContent = documentContext ? documentContext + parsed.data.content : parsed.data.content;
      messagesToSend.push({ role: "user", content: finalUserContent });
      
      // We will perform atomic transaction check ONLY if provider generation is successful to avoid orphans.
      // But we lock them strictly via query conditions.
    } else {
      // 2. Guest User Flow
      const parsed = guestChatSchema.safeParse(body);
      if (!parsed.success) {
        return createErrorResponse("VALIDATION_FAILED", "Data percakapan tamu tidak valid.", parsed.error.format(), 400, undefined, requestId);
      }

      modelId = parsed.data.modelId || aiConfig.defaultModel;
      messagesToSend = [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
        ...parsed.data.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];
    }

    // 3. Initiate Upstream Provider Stream
    let providerResponse: Response;
    const providerStart = performance.now();

    try {
      providerResponse = await defaultProvider.chat(
        {
          model: modelId,
          messages: messagesToSend,
          temperature: body.temperature,
          max_tokens: body.maxOutputTokens,
          stream: true,
        },
        clientSignal
      );
      providerConnectMs = Math.round(performance.now() - providerStart);
    } catch (err: any) {
      providerConnectMs = Math.round(performance.now() - providerStart);
      const errorDetails = defaultProvider.normalizeError(err);

      // If authenticated, record failure in DB
      if (assistantMessageId) {
        await prisma.message
          .update({
            where: { id: assistantMessageId },
            data: {
              status: "FAILED",
              errorCode: errorDetails.code,
            },
          })
          .catch(() => {});
      }

      logger.error("Chat upstream provider connection failed", {
        requestId,
        isAuth,
        modelId,
        errorCode: errorDetails.code,
        message: errorDetails.message,
        authMs,
        redisMs,
        dbMs,
        providerConnectMs,
      });

      return createErrorResponse(errorDetails.code, errorDetails.message, undefined, errorDetails.status, undefined, requestId);
    }

    // 4. Stream response back via Server-Sent Events (SSE)
    const upstreamStream = providerResponse.body;
    if (!upstreamStream) {
      return createErrorResponse("STREAM_MALFORMED", "Response stream penyedia AI tidak tersedia.", undefined, 502, undefined, requestId);
    }

    let accumulatedContent = "";
    let finalFinishReason: string | null = null;
    let finalUsage: any = null;
    let timeToFirstByteMs: number | null = null;
    let firstChunk = true;
    let firstReasoningLogged = false;
    let firstContentLogged = false;

    clientSignal?.addEventListener("abort", () => {
      clientAborted = true;
    });

    const transformStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper to send SSE formatted event
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller might be closed
          }
        };

        // Stream idle timeout tracker (60s)
        let idleTimer: NodeJS.Timeout | null = null;
        const resetIdleTimer = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            controller.error(new Error("Stream idle timeout exceeded (60s)"));
          }, aiConfig.streamIdleTimeoutMs);
        };
        resetIdleTimer();

        try {
          const parsedGenerator = parseSSEStream(upstreamStream, resetIdleTimer);

          for await (const chunk of parsedGenerator) {
            resetIdleTimer();

            if (firstChunk) {
              firstChunk = false;
              timeToFirstByteMs = Date.now() - startTime;
            }

            if (chunk.reasoningContent) {
              if (!firstReasoningLogged) {
                firstReasoningLogged = true;
                firstReasoningMs = Date.now() - startTime;
              }
              sendEvent("status", { status: "reasoning" });
            }

            if (chunk.content) {
              if (!firstContentLogged) {
                firstContentLogged = true;
                firstContentMs = Date.now() - startTime;
              }
              sendEvent("status", { status: "answering" });
              accumulatedContent += chunk.content;
              sendEvent("content", {
                content: chunk.content,
                messageId: assistantMessageId,
              });
            }

            if (chunk.finishReason) {
              finalFinishReason = chunk.finishReason;
            }
            if (chunk.usage) {
              finalUsage = chunk.usage;
            }

            if (clientAborted) {
              break;
            }
          }

          if (idleTimer) clearTimeout(idleTimer);

          const completionState = clientAborted ? "CANCELLED" : "COMPLETED";

          if (assistantMessageId) {
            await prisma.$transaction(async (tx) => {
                await tx.message.update({
                    where: { id: assistantMessageId },
                    data: {
                    content: accumulatedContent,
                    status: completionState,
                    finishReason: finalFinishReason,
                    promptTokens: finalUsage?.promptTokens ?? null,
                    completionTokens: finalUsage?.completionTokens ?? null,
                    totalTokens: finalUsage?.totalTokens ?? null,
                    },
                });

                if (isAuth && globalAttachmentIdsToUpdate && globalAttachmentIdsToUpdate.length > 0) {
                     // Atomic link
                     const userMsg = await tx.message.findFirst({
                         where: { conversationId: conversationId!, sequenceNo: assistantSeqNumber - 1, role: "USER" }
                     });
                     if (userMsg) {
                         await tx.documentAttachment.updateMany({
                             where: { id: { in: globalAttachmentIdsToUpdate }, status: "READY" },
                             data: { status: "ATTACHED", messageId: userMsg.id }
                         });
                     }
                }
            }).catch((e) => {
                logger.error("Failed to persist final assistant message and attachments", { requestId, error: e.message });
            });
          }

          sendEvent("done", {
            content: accumulatedContent,
            finishReason: finalFinishReason,
            messageId: assistantMessageId,
            status: completionState,
            requestId,
          });

          const totalMs = Date.now() - startTime;

          console.log("[PERF CHAT]", {
            requestId,
            authMs,
            redisMs,
            dbMs,
            providerConnectMs,
            firstReasoningMs,
            firstContentMs,
            totalMs,
            completionState,
          });

          logger.info("Chat generation finished", {
            requestId,
            isAuth,
            modelId,
            timeToFirstByteMs: timeToFirstByteMs ?? 0,
            authMs,
            redisMs,
            dbMs,
            providerConnectMs,
            firstReasoningMs: firstReasoningMs ?? undefined,
            firstContentMs: firstContentMs ?? undefined,
            totalMs,
            completionState,
          });

          controller.close();
        } catch (streamErr: any) {
          const errorDetails = defaultProvider.normalizeError(streamErr);
          const completionState = streamErr.name === "AbortError" || clientAborted ? "CANCELLED" : "FAILED";

          if (assistantMessageId) {
            await prisma.message
              .update({
                where: { id: assistantMessageId },
                data: {
                  content: accumulatedContent,
                  status: completionState,
                  errorCode: errorDetails.code,
                },
              })
              .catch(() => {});
          }

          logger.error("[CHAT STREAM FATAL]", {
            requestId,
            isAuth,
            modelId,
            completionState,
            errorCode: errorDetails.code,
            message: errorDetails.message,
            totalMs: Date.now() - startTime,
          });

          sendEvent("error", {
            error: errorDetails.code,
            message: errorDetails.message,
            partialContent: accumulatedContent,
            messageId: assistantMessageId,
            requestId,
          });

          controller.close();
        }
      },
    });

    return new Response(transformStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering in NGINX
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    logger.error("[CHAT ROUTE FATAL]", {
      requestId,
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return createErrorResponse(
      "INTERNAL_ERROR",
      "Terjadi kesalahan saat memproses percakapan.",
      undefined,
      500,
      undefined,
      requestId
    );
  }
}
