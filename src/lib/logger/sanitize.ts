const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passwordhash",
  "apikey",
  "api_key",
  "authorization",
  "token",
  "cookie",
  "prompt",
  "systemprompt",
  "content",
  "ip",
  "email",
  "secret",
];

export function sanitizeLogData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    // Redact bearer tokens or jwt-like strings in general text
    if (/bearer\s+[a-zA-Z0-9_\-\.]+/i.test(input)) {
      return "[REDACTED_AUTH]" as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeLogData(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) =>
        lowerKey.includes(pattern)
      );

      if (isSensitive) {
        sanitizedObj[key] = "[REDACTED]";
      } else if (value && typeof value === "object") {
        sanitizedObj[key] = sanitizeLogData(value);
      } else {
        sanitizedObj[key] = value;
      }
    }
    return sanitizedObj as unknown as T;
  }

  return input;
}
