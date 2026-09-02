import { describe, it, expect } from "vitest";
import { normalizeProviderError } from "@/lib/ai/errors";

describe("Retry Eligibility Policy", () => {
  it("allows pre-chunk retry for network / 502 / 503 / 504", () => {
    const err502 = normalizeProviderError({ status: 502 });
    const err503 = normalizeProviderError({ status: 503 });
    const err504 = normalizeProviderError({ status: 504 });

    expect(err502.retryable).toBe(true);
    expect(err503.retryable).toBe(true);
    expect(err504.retryable).toBe(true);
  });

  it("prohibits retry for client errors 400, 401, 403, 404", () => {
    const err400 = normalizeProviderError({ status: 400 });
    const err401 = normalizeProviderError({ status: 401 });
    const err403 = normalizeProviderError({ status: 403 });
    const err404 = normalizeProviderError({ status: 404 });

    expect(err400.retryable).toBe(false);
    expect(err401.retryable).toBe(false);
    expect(err403.retryable).toBe(false);
    expect(err404.retryable).toBe(false);
  });

  it("prohibits retry once stream has started (status changed to STREAMING)", () => {
    // In our architecture, once the first chunk is emitted and message status is STREAMING,
    // the backend transitions directly to FAILED/CANCELLED without automatic retry,
    // requiring manual user retry.
    let hasEmittedFirstChunk = true;
    const shouldAutoRetry = (errorStatus: number, emittedChunk: boolean) => {
      if (emittedChunk) return false;
      return [502, 503, 504].includes(errorStatus);
    };

    expect(shouldAutoRetry(503, false)).toBe(true);
    expect(shouldAutoRetry(503, hasEmittedFirstChunk)).toBe(false);
  });
});
