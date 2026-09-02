export interface ParsedChunk {
  content?: string;
  reasoningContent?: string;
  finishReason?: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Parses raw SSE stream from OpenAI-compatible upstream.
 * Uses a persistent text buffer splitting strictly on SSE event boundaries (\n\n).
 * Safely handles fragmented network chunks, reasoning tokens, and content tokens independently.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onRawChunk?: () => void
): AsyncGenerator<ParsedChunk, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Notify caller of raw chunk arrival (resets stream-idle timeout)
      if (onRawChunk) onRawChunk();

      buffer += decoder.decode(value, { stream: true });

      // SSE standard: events are delimited by double newlines (\n\n or \r\n\r\n)
      const events = buffer.split(/\r?\n\r?\n/);
      // The last element is incomplete until the next double newline arrives
      buffer = events.pop() ?? "";

      for (const event of events) {
        if (!event.trim()) continue;

        const lines = event.split(/\r?\n/);

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) {
            // Keepalive comment or empty line
            continue;
          }

          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            if (dataStr === "[DONE]") {
              // Upstream indicator that stream is ending
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const choice = parsed.choices?.[0];
              const delta = choice?.delta;

              if (!delta && !choice?.finish_reason && !parsed.usage) {
                continue;
              }

              const reasoning = delta?.reasoning_content ?? delta?.reasoning;
              const content = delta?.content;
              const finishReason = choice?.finish_reason ?? null;

              const usage = parsed.usage
                ? {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens,
                  }
                : undefined;

              // Process reasoning and content independently (never skip content if reasoning was present)
              if (reasoning || content || finishReason || usage) {
                yield {
                  content: content !== undefined && content !== null ? String(content) : undefined,
                  reasoningContent: reasoning !== undefined && reasoning !== null ? String(reasoning) : undefined,
                  finishReason,
                  usage,
                };
              }
            } catch {
              // Ignore malformed JSON line or keep buffer
            }
          }
        }
      }
    }

    // Process any remaining data left in buffer
    if (buffer.trim() && buffer.startsWith("data:")) {
      const dataStr = buffer.slice(5).trim();
      if (dataStr && dataStr !== "[DONE]") {
        try {
          const parsed = JSON.parse(dataStr);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta;
          const reasoning = delta?.reasoning_content ?? delta?.reasoning;
          const content = delta?.content;
          const finishReason = choice?.finish_reason ?? null;
          if (reasoning || content || finishReason) {
            yield {
              content: content !== undefined && content !== null ? String(content) : undefined,
              reasoningContent: reasoning !== undefined && reasoning !== null ? String(reasoning) : undefined,
              finishReason,
            };
          }
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
