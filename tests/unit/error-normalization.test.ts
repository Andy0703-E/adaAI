import { describe, it, expect } from "vitest";
import { normalizeProviderError, AIProviderException } from "@/lib/ai/errors";

describe("Error Normalization", () => {
  it("normalizes 401 auth failure without leaking API key", () => {
    const errorWithSecret = {
      status: 401,
      message: "Unauthorized with key sk-secret-123456789",
    };

    const normalized = normalizeProviderError(errorWithSecret);
    expect(normalized.code).toBe("PROVIDER_AUTH_FAILED");
    expect(normalized.message).not.toContain("sk-secret-123456789");
    expect(normalized.message).not.toContain("key");
    expect(normalized.retryable).toBe(false);
  });

  it("normalizes 404 model not found", () => {
    const normalized = normalizeProviderError({ status: 404 });
    expect(normalized.code).toBe("MODEL_UNAVAILABLE");
    expect(normalized.retryable).toBe(false);
  });

  it("normalizes 429 rate limit as retryable", () => {
    const normalized = normalizeProviderError({ status: 429 });
    expect(normalized.code).toBe("RATE_LIMITED");
    expect(normalized.retryable).toBe(true);
  });

  it("normalizes 503 provider unavailable as retryable", () => {
    const normalized = normalizeProviderError({ status: 503 });
    expect(normalized.code).toBe("PROVIDER_UNAVAILABLE");
    expect(normalized.retryable).toBe(true);
  });

  it("normalizes user AbortError", () => {
    const abortErr = new Error("This operation was aborted");
    abortErr.name = "AbortError";

    const normalized = normalizeProviderError(abortErr);
    expect(normalized.code).toBe("REQUEST_ABORTED");
    expect(normalized.retryable).toBe(false);
  });
});
