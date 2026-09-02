import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { createErrorResponse } from "@/lib/utils/error-response";

const MAX_RESULTS = 40;

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const startedAt = performance.now();

  try {
    const authStart = performance.now();
    const session = await auth();
    const authMs = Math.round(performance.now() - authStart);

    if (!session?.user?.id) {
      return createErrorResponse("UNAUTHORIZED", "Sesi tidak valid atau telah berakhir.", undefined, 401, undefined, requestId);
    }

    const rlStart = performance.now();
    const rl = await rateLimit({
      scope: "search",
      userId: session.user.id,
    });
    const redisMs = Math.round(performance.now() - rlStart);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Terlalu banyak permintaan pencarian. Coba lagi dalam ${rl.retryAfter} detik.`,
          requestId,
          retryAfter: rl.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter),
            "X-Request-Id": requestId,
          },
        }
      );
    }

    const q =
      req.nextUrl.searchParams.get("q")?.trim() ?? "";

    // 0–1 karakter: jangan query DB
    if (q.length < 2) {
      return NextResponse.json(
        {
          items: [],
          query: q,
        },
        {
          headers: {
            "X-Request-Id": requestId,
          },
        }
      );
    }

    // 2 karakter = title only
    // >=3 karakter = title + content
    const searchContent = q.length >= 3;

    const queryStartedAt = performance.now();

    const conversations =
      await prisma.conversation.findMany({
        where: {
          userId: session.user.id,
          status: { not: "ARCHIVED" },

          OR: searchContent
            ? [
                {
                  title: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  messages: {
                    some: {
                      content: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ]
            : [
                {
                  title: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              ],
        },

        select: {
          id: true,
          title: true,
          modelId: true,
          providerKey: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: [
          {
            lastMessageAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        take: MAX_RESULTS,
      });

    const dbMs = Math.round(performance.now() - queryStartedAt);
    const totalMs = Math.round(performance.now() - startedAt);

    console.log("[PERF SEARCH]", {
      requestId,
      query: q,
      mode: searchContent ? "title+content" : "title-only",
      authMs,
      redisMs,
      dbMs,
      totalMs,
      results: conversations.length,
    });

    return NextResponse.json(
      {
        items: conversations,
        query: q,
        mode: searchContent ? "title+content" : "title-only",
      },
      {
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error) {
    console.error("[SEARCH ERROR]", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse("INTERNAL_ERROR", "Gagal memproses pencarian percakapan.", undefined, 500, undefined, requestId);
  }
}
