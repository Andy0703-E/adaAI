import { createHash } from "crypto";

export function hashIdentifier(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

// Backward-compatible alias
export const hashIp = hashIdentifier;

export function buildRateLimitKey(params: {
  scope: string;
  userId?: string | null;
  ip?: string | null;
  identifier?: string | null;
}): string {
  const { scope, userId, ip, identifier } = params;

  if (userId && userId.trim().length > 0) {
    return `rate:user:${userId.trim()}:${scope}`;
  }

  if (scope === "login") {
    const rawTarget = identifier || ip || "unknown";
    const hashedTarget = hashIdentifier(rawTarget);
    return `rate:login:${hashedTarget}`;
  }

  const raw = identifier || ip || "unknown";
  const hashed = hashIdentifier(raw);
  return `rate:ip:${hashed}:${scope}`;
}
