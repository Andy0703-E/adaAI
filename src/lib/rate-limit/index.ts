import { getRedisClient } from "./redis";
import { buildRateLimitKey } from "./keys";
import { RATE_LIMIT_POLICIES, RateLimitPolicy, RateLimitScope } from "./policy";
import { logger } from "../logging/logger";

export interface RateLimitOptions {
  scope: RateLimitScope;
  userId?: string | null;
  ip?: string | null;
  identifier?: string | null;
  customPolicy?: Partial<RateLimitPolicy>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number; // Seconds until quota resets
  error?: "REDIS_UNAVAILABLE" | "RATE_LIMIT_EXCEEDED";
}

/**
 * Atomic sliding-window rate limiter via Lua script:
 * KEYS[1]: Rate limit key
 * ARGV[1]: Window duration (ms)
 * ARGV[2]: Maximum allowed requests
 * ARGV[3]: Unique random suffix
 * ARGV[4]: Window duration in seconds (for TTL)
 *
 * Uses Redis TIME command for authoritative cluster/serverless clock sync.
 * Rejected requests DO NOT execute ZADD.
 *
 * Returns:
 * [allowed (1 or 0), currentCount, oldestTimestamp (ms), nowMs]
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local maxLimit = tonumber(ARGV[2])
local randomSuffix = ARGV[3]
local windowSec = tonumber(ARGV[4])

local rTime = redis.call('TIME')
local nowMs = (tonumber(rTime[1]) * 1000) + math.floor(tonumber(rTime[2]) / 1000)

local clearBefore = nowMs - windowMs
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

local currentCount = redis.call('ZCARD', key)

if currentCount < maxLimit then
  local memberId = tostring(nowMs) .. ':' .. randomSuffix
  redis.call('ZADD', key, nowMs, memberId)
  redis.call('EXPIRE', key, windowSec)
  return {1, currentCount + 1, 0, nowMs}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTs = 0
  if oldest and #oldest >= 2 then
    oldestTs = tonumber(oldest[2])
  end
  return {0, currentCount, oldestTs, nowMs}
end
`;

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const t0 = performance.now();
  const { scope, userId, ip, identifier, customPolicy } = options;
  const basePolicy = RATE_LIMIT_POLICIES[scope];
  const policy: RateLimitPolicy = {
    ...basePolicy,
    ...customPolicy,
  };

  const key = buildRateLimitKey({ scope, userId, ip, identifier });
  const client = getRedisClient();

  if (!client) {
    const redisMs = Math.round(performance.now() - t0);
    if (policy.fallback === "fail-closed") {
      logger.error("Redis unavailable for high-risk rate limit scope; failing closed", {
        scope,
        fallbackMode: "fail-closed",
        redisMs,
      });
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfter: policy.windowSeconds,
        error: "REDIS_UNAVAILABLE",
      };
    }

    logger.warn("Redis unavailable for low-risk rate limit scope; failing open", {
      scope,
      fallbackMode: "fail-open",
      redisMs,
    });
    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit,
      retryAfter: 0,
    };
  }

  try {
    if (client.status !== "ready" && client.status !== "connecting") {
      await client.connect();
    }

    const windowMs = policy.windowSeconds * 1000;
    const randomSuffix = Math.random().toString(36).slice(2, 10);

    const evalResult = (await client.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(windowMs),
      String(policy.limit),
      randomSuffix,
      String(policy.windowSeconds)
    )) as [number, number, number, number];

    const isAllowed = evalResult[0] === 1;
    const count = evalResult[1];
    const oldestTimestamp = evalResult[2];
    const redisNowMs = evalResult[3] || Date.now();

    let retryAfter = 0;
    if (!isAllowed) {
      if (oldestTimestamp > 0) {
        const msUntilExpiry = oldestTimestamp + windowMs - redisNowMs;
        retryAfter = Math.max(1, Math.ceil(msUntilExpiry / 1000));
      } else {
        retryAfter = policy.windowSeconds;
      }
    }

    const remaining = Math.max(0, policy.limit - count);
    const redisMs = Math.round(performance.now() - t0);

    // Structured observability log (no sensitive raw IP/email)
    logger.info("Rate limit checked", {
      scope,
      allowed: isAllowed,
      remaining,
      retryAfter,
      redisMs,
      fallbackMode: "none",
    });

    return {
      allowed: isAllowed,
      limit: policy.limit,
      remaining,
      retryAfter,
      ...(isAllowed ? {} : { error: "RATE_LIMIT_EXCEEDED" }),
    };
  } catch (err) {
    const redisMs = Math.round(performance.now() - t0);
    logger.error("Rate limit check failed against Redis:", {
      scope,
      error: (err as Error).message,
      redisMs,
    });

    if (policy.fallback === "fail-closed") {
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfter: policy.windowSeconds,
        error: "REDIS_UNAVAILABLE",
      };
    }

    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit,
      retryAfter: 0,
    };
  }
}

export * from "./redis";
export * from "./keys";
export * from "./policy";
