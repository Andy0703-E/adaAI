import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getRedisClient } from "@/lib/rate-limit/redis";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface ServiceCheckResult {
  status: "up" | "down" | "disabled";
  latencyMs: number;
  error?: string;
}

export async function GET() {
  const t0 = performance.now();
  const checks: {
    database: ServiceCheckResult;
    redis: ServiceCheckResult;
  } = {
    database: { status: "down", latencyMs: 0 },
    redis: { status: "disabled", latencyMs: 0 },
  };

  let allReady = true;

  // 1. PostgreSQL Database Check with 2000ms timeout
  const dbStart = performance.now();
  try {
    const dbPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database check timeout (2000ms)")), 2000)
    );

    await Promise.race([dbPromise, timeoutPromise]);
    checks.database = {
      status: "up",
      latencyMs: Math.round(performance.now() - dbStart),
    };
  } catch (err) {
    allReady = false;
    checks.database = {
      status: "down",
      latencyMs: Math.round(performance.now() - dbStart),
      error: (err as Error).message,
    };
  }

  // 2. Redis Check with 2000ms timeout (if configured)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisStart = performance.now();
    try {
      const client = getRedisClient();
      if (!client) {
        throw new Error("Redis client initialization failed");
      }

      if (client.status !== "ready" && client.status !== "connecting") {
        await client.connect();
      }

      const pingPromise = client.ping();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis check timeout (2000ms)")), 2000)
      );

      await Promise.race([pingPromise, timeoutPromise]);
      checks.redis = {
        status: "up",
        latencyMs: Math.round(performance.now() - redisStart),
      };
    } catch (err) {
      allReady = false;
      checks.redis = {
        status: "down",
        latencyMs: Math.round(performance.now() - redisStart),
        error: (err as Error).message,
      };
    }
  }

  const totalMs = Math.round(performance.now() - t0);

  if (!allReady) {
    logger.warn("Readiness check failed", {
      databaseStatus: checks.database.status,
      redisStatus: checks.redis.status,
      totalMs,
    });

    return NextResponse.json(
      {
        status: "not_ready",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: "ready",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
