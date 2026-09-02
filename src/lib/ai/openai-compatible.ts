import { AIModel, AIProvider, ChatRequest } from "@/types/ai";
import { aiConfig } from "./config";
import { AIProviderException, normalizeProviderError } from "./errors";
import { logger } from "../logging/logger";

export class OpenAICompatibleProvider implements AIProvider {
  public readonly providerKey = "bandel-openai-compatible";

  constructor(
    private baseUrl: string = aiConfig.baseUrl,
    private apiKey: string = aiConfig.apiKey,
    private chatPath: string = aiConfig.chatPath,
    private modelsPath: string = aiConfig.modelsPath,
    private firstByteTimeoutMs: number = aiConfig.firstByteTimeoutMs,
    private streamIdleTimeoutMs: number = aiConfig.streamIdleTimeoutMs,
    private totalTimeoutMs: number = aiConfig.totalTimeoutMs
  ) {}

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async listModels(signal?: AbortSignal): Promise<AIModel[]> {
    const url = `${this.baseUrl}${this.modelsPath}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
        signal: signal ?? AbortSignal.timeout(this.firstByteTimeoutMs),
      });

      if (!response.ok) {
        throw new AIProviderException({
          code: "PROVIDER_UNAVAILABLE",
          message: `Gagal memuat model provider (HTTP ${response.status})`,
          status: response.status,
        });
      }

      const data = await response.json();
      const rawList = Array.isArray(data) ? data : data?.data;

      if (!Array.isArray(rawList)) {
        throw new AIProviderException({
          code: "STREAM_MALFORMED",
          message: "Format daftar model tidak valid.",
        });
      }

      return rawList.map((m: Record<string, unknown>) => {
        const id = String(m.id ?? "");
        const name = (m.name as string) || (m.display_name as string) || id;
        const isAvailable = m.enabled !== false && m.is_available !== false;
        const contextWindow = typeof m.context_window === "number" ? m.context_window : null;
        const maxTokens = typeof m.max_output_tokens === "number" ? m.max_output_tokens : null;

        return {
          id,
          name,
          isAvailable,
          providerKey: this.providerKey,
          capabilities: {
            text: true,
            vision: Boolean(m.vision),
            temperature: true,
            ...(typeof m.capabilities === "object" && m.capabilities !== null
              ? (m.capabilities as Record<string, unknown>)
              : {}),
          },
          contextWindow,
          maxOutputTokens: maxTokens,
          metadata: m,
        };
      });
    } catch (err) {
      logger.warn("Failed to fetch models from provider", {
        route: url,
        error: (err as Error).message,
      });
      throw this.normalizeError(err);
    }
  }

  async chat(request: ChatRequest, userSignal?: AbortSignal): Promise<Response> {
    const url = `${this.baseUrl}${this.chatPath}`;
    const maxRetries = 0; // Disabled temporarily for exact error tracing
    let attempt = 0;
    let lastError: unknown = null;
    const requestStartedAt = Date.now();

    console.log("[AI Upstream] Request started", {
      model: request.model,
      time: new Date().toISOString(),
    });

    const totalAbortController = new AbortController();
    const totalTimer = setTimeout(() => {
      totalAbortController.abort(new Error("Total timeout exceeded"));
    }, this.totalTimeoutMs);

    // Forward user cancel to upstream
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(totalTimer);
        throw new AIProviderException({
          code: "REQUEST_ABORTED",
          message: "Permintaan dibatalkan sebelum dimulai.",
          retryable: false,
        });
      }
      userSignal.addEventListener("abort", () => {
        totalAbortController.abort(userSignal.reason);
      });
    }

    try {
      while (attempt <= maxRetries) {
        attempt++;

        // First-byte timeout controller per attempt (30s)
        const attemptController = new AbortController();
        const firstByteTimer = setTimeout(() => {
          attemptController.abort(new Error("First-byte timeout exceeded"));
        }, this.firstByteTimeoutMs);

        // Combined signal for this attempt
        const attemptSignal = AbortSignal.any
          ? AbortSignal.any([userSignal ?? new AbortController().signal, totalAbortController.signal, attemptController.signal])
          : totalAbortController.signal;

        try {
          const bodyPayload: Record<string, unknown> = {
            model: request.model,
            messages: request.messages,
            stream: request.stream !== false,
          };

          if (typeof request.temperature === "number") {
            bodyPayload.temperature = request.temperature;
          }
          if (typeof request.max_tokens === "number") {
            bodyPayload.max_tokens = request.max_tokens;
          }

          const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(bodyPayload),
            signal: attemptSignal,
          });

          clearTimeout(firstByteTimer);

          console.log("[AI Upstream] Provider headers received", {
            model: request.model,
            ms: Date.now() - requestStartedAt,
            status: response.status,
          });

          if (!response.ok) {
            let errorBody: string | undefined;
            try {
              errorBody = await response.text();
            } catch {
              // ignore
            }

            const isRetryable =
              [502, 503, 504].includes(response.status) ||
              (response.status === 429 && attempt <= maxRetries);

            const providerErr = new AIProviderException({
              code:
                response.status === 401 || response.status === 403
                  ? "PROVIDER_AUTH_FAILED"
                  : response.status === 404
                  ? "MODEL_UNAVAILABLE"
                  : response.status === 429
                  ? "RATE_LIMITED"
                  : [502, 503, 504].includes(response.status)
                  ? "PROVIDER_UNAVAILABLE"
                  : "VALIDATION_FAILED",
              message:
                response.status === 401 || response.status === 403
                  ? "Layanan AI sedang mengalami kendala autentikasi."
                  : response.status === 404
                  ? "Model tidak ditemukan pada penyedia layanan."
                  : `Penyedia layanan mengembalikan status HTTP ${response.status}`,
              status: response.status,
              retryable: isRetryable,
              originalError: errorBody,
            });

            if (isRetryable && attempt <= maxRetries && !userSignal?.aborted) {
              const backoff = attempt * 1000;
              await new Promise((res) => setTimeout(res, backoff));
              continue;
            }

            throw providerErr;
          }

          if (!response.body) {
            throw new AIProviderException({
              code: "STREAM_MALFORMED",
              message: "Penyedia layanan tidak mengembalikan data stream.",
              retryable: false,
            });
          }

          // Return stream with idle timeout wrapper
          clearTimeout(totalTimer);
          return wrapStreamWithIdleTimeout(response, this.streamIdleTimeoutMs, userSignal);
        } catch (err) {
          clearTimeout(firstByteTimer);

          if (userSignal?.aborted) {
            throw new AIProviderException({
              code: "REQUEST_ABORTED",
              message: "Permintaan dihentikan oleh pengguna.",
              retryable: false,
            });
          }

          const normalized = this.normalizeError(err);
          lastError = normalized;

          if (normalized.retryable && attempt <= maxRetries && !userSignal?.aborted) {
            const backoff = attempt * 1000;
            await new Promise((res) => setTimeout(res, backoff));
            continue;
          }

          throw normalized;
        }
      }

      throw this.normalizeError(lastError);
    } finally {
      clearTimeout(totalTimer);
    }
  }

  normalizeError(error: unknown): AIProviderException {
    return normalizeProviderError(error);
  }
}

/**
 * Wraps a ReadableStream to monitor idle time between received chunks.
 */
function wrapStreamWithIdleTimeout(
  response: Response,
  idleTimeoutMs: number,
  userSignal?: AbortSignal
): Response {
  if (!response.body) return response;

  const originalStream = response.body;
  const reader = originalStream.getReader();

  let idleTimer: NodeJS.Timeout | null = null;

  const resetIdleTimer = (controller: ReadableStreamDefaultController) => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      controller.error(
        new AIProviderException({
          code: "PROVIDER_TIMEOUT",
          message: "Koneksi stream terputus karena waktu tunggu tanpa chunk terlampaui.",
          retryable: false,
        })
      );
      try {
        reader.cancel();
      } catch {
        // ignore
      }
    }, idleTimeoutMs);
  };

  const wrappedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      resetIdleTimer(controller);

      if (userSignal) {
        userSignal.addEventListener("abort", () => {
          if (idleTimer) clearTimeout(idleTimer);
          try {
            reader.cancel();
          } catch {
            // ignore
          }
          controller.error(
            new AIProviderException({
              code: "REQUEST_ABORTED",
              message: "Permintaan dibatalkan pengguna.",
              retryable: false,
            })
          );
        });
      }

      function pump(): Promise<void> {
        return reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (idleTimer) clearTimeout(idleTimer);
              controller.close();
              return;
            }
            resetIdleTimer(controller);
            controller.enqueue(value);
            return pump();
          })
          .catch((err) => {
            if (idleTimer) clearTimeout(idleTimer);
            controller.error(err);
          });
      }

      return pump();
    },
    cancel(reason) {
      if (idleTimer) clearTimeout(idleTimer);
      return reader.cancel(reason);
    },
  });

  return new Response(wrappedStream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export const defaultProvider = new OpenAICompatibleProvider();
