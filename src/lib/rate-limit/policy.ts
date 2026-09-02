export type RateLimitScope =
  | "register"
  | "login"
  | "chat"
  | "conversation_create"
  | "search"
  | "document_upload";

export type FallbackBehavior = "fail-closed" | "fail-open";

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
  fallback: FallbackBehavior;
}

export const RATE_LIMIT_POLICIES: Record<RateLimitScope, RateLimitPolicy> = {
  // Unauthenticated sensitive auth: 5 / 15 minutes / IP (fail-closed for abuse prevention)
  register: {
    limit: 5,
    windowSeconds: 15 * 60,
    fallback: "fail-closed",
  },
  // Unauthenticated login attempts: 10 / 15 minutes / IP (fail-closed)
  login: {
    limit: 10,
    windowSeconds: 15 * 60,
    fallback: "fail-closed",
  },
  // Expensive AI invocation: 30 / minute / user (fail-closed to prevent provider cost/abuse)
  chat: {
    limit: 30,
    windowSeconds: 60,
    fallback: "fail-closed",
  },
  // Conversation creation: 20 / minute / user
  conversation_create: {
    limit: 20,
    windowSeconds: 60,
    fallback: "fail-open",
  },
  // Heavy DB search: 30 / minute / user
  search: {
    limit: 30,
    windowSeconds: 60,
    fallback: "fail-open",
  },
  // Document upload: 10 / 10 minutes / user (fail-closed for resource constraints)
  document_upload: {
    limit: 10,
    windowSeconds: 10 * 60,
    fallback: "fail-closed",
  },
};
