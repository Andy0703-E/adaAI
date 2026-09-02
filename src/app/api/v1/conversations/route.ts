import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { createConversationSchema } from "@/lib/validation/conversation";
import { createErrorResponse } from "@/lib/utils/error-response";
import { defaultProvider } from "@/lib/ai/openai-compatible";
import { aiConfig } from "@/lib/ai/config";
import { rateLimit } from "@/lib/rate-limit";
import { ConversationStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const t0 = performance.now();
  try {
    const authStart = performance.now();
    const userId = await requireAuthUserId();
    const authMs = Math.round(performance.now() - authStart);

    const { searchParams } = new URL(req.url);

    const statusParam = searchParams.get("status")?.toUpperCase() as ConversationStatus | undefined;
    const statusFilter = statusParam && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(statusParam)
      ? statusParam
      : undefined;

    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

    // Compound cursor: "lastMessageAt_ISO|id" — stable ordering even when timestamps collide
    const cursorParam = searchParams.get("cursor");
    let cursorWhere: Record<string, unknown> | undefined = undefined;

    if (cursorParam) {
      const [cursorTs, cursorId] = cursorParam.split("|");
      if (cursorTs && cursorId) {
        // Items BEFORE this cursor in desc order: lastMessageAt < cursorTs OR (lastMessageAt == cursorTs AND id < cursorId)
        cursorWhere = {
          OR: [
            { lastMessageAt: { lt: new Date(cursorTs) } },
            {
              lastMessageAt: new Date(cursorTs),
              id: { lt: cursorId },
            },
          ],
        };
      }
    }

    const queryStart = performance.now();
    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
        ...(statusFilter ? { status: statusFilter } : { status: { not: "ARCHIVED" } }),
        ...cursorWhere,
      },
      take: limit + 1,
      orderBy: [
        { lastMessageAt: "desc" },
        { id: "desc" },
      ],
      select: {
        id: true,
        title: true,
        status: true,
        modelId: true,
        providerKey: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const queryMs = Math.round(performance.now() - queryStart);

    const serializeStart = performance.now();
    let nextCursor: string | null = null;
    const hasNextPage = conversations.length > limit;
    if (hasNextPage) {
      const nextItem = conversations.pop()!;
      const ts = nextItem.lastMessageAt ? nextItem.lastMessageAt.toISOString() : new Date(0).toISOString();
      nextCursor = `${ts}|${nextItem.id}`;
    }

    const payload = { data: conversations, meta: { nextCursor, hasNextPage } };
    const json = JSON.stringify(payload);
    const payloadBytes = Buffer.byteLength(json, "utf8");
    const serializationMs = Math.round(performance.now() - serializeStart);
    const totalMs = Math.round(performance.now() - t0);

    console.log("[PERF CONVERSATIONS]", {
      requestId,
      authMs,
      dbMs: queryMs,
      serializationMs,
      totalMs,
      rowCount: conversations.length,
      payloadBytes,
      hasNextPage,
    });

    return NextResponse.json(payload, {
      headers: {
        "X-Request-Id": requestId,
      },
    });
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message, undefined, 401, undefined, requestId);
    }
    console.error("GET conversations error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal memuat daftar percakapan.", undefined, 500, undefined, requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const userId = await requireAuthUserId();

    const rl = await rateLimit({
      scope: "conversation_create",
      userId,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          retryAfter: rl.retryAfter,
          message: `Terlalu banyak pembuatan percakapan baru. Coba lagi dalam ${rl.retryAfter} detik.`,
          requestId,
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

    const body = await req.json().catch(() => ({}));
    const parse = createConversationSchema.safeParse(body);

    if (!parse.success) {
      return createErrorResponse("VALIDATION_FAILED", "Data percakapan tidak valid.", parse.error.format(), 400, undefined, requestId);
    }

    const { title, modelId, systemPrompt } = parse.data;

    // Get user default model or fallback
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    const finalModelId = modelId || aiConfig.defaultModel;
    const finalProviderKey = defaultProvider.providerKey;

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || "New Chat",
        status: "DRAFT",
        modelId: finalModelId,
        providerKey: finalProviderKey,
        systemPrompt: systemPrompt ?? userSettings?.systemPrompt ?? null,
      },
    });

    return NextResponse.json(
      {
        data: conversation,
      },
      {
        status: 201,
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message, undefined, 401, undefined, requestId);
    }
    console.error("POST conversation error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal membuat percakapan baru.", undefined, 500, undefined, requestId);
  }
}
