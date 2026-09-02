import Redis from "ioredis";
import { logger } from "../logging/logger";

let redisClient: Redis | null = null;
let redisInitialized = false;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisInitialized) {
    redisInitialized = true;
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        },
      });

      redisClient.on("error", (err) => {
        logger.warn("Redis client connection error:", { error: err.message });
      });
    } catch (err) {
      logger.error("Failed to initialize Redis client:", { error: (err as Error).message });
      redisClient = null;
    }
  }

  return redisClient;
}

export function resetRedisClientForTesting(): void {
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch {
      // ignore
    }
  }
  redisClient = null;
  redisInitialized = false;
}
