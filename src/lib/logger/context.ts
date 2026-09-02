export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  durationMs?: number;
  authMs?: number;
  rateLimitMs?: number;
  dbMs?: number;
  redisMs?: number;
  providerConnectMs?: number;
  firstReasoningMs?: number;
  firstContentMs?: number;
  totalMs?: number;
  status?: number;
  errorCode?: string;
  modelId?: string;
  providerKey?: string;
  fallbackMode?: string;
  [key: string]: unknown;
}

export function extractRequestId(headers: Headers | Record<string, string | null | undefined>): string {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("x-request-id") || crypto.randomUUID();
  }

  const record = headers as Record<string, string | null | undefined>;
  return record["x-request-id"] || record["X-Request-Id"] || crypto.randomUUID();
}
