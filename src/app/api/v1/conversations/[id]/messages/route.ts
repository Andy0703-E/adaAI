import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { createErrorResponse } from "@/lib/utils/error-response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const t0 = performance.now();
  try {
    const userId = await requireAuthUserId();
    const { id } = await params;

    // Single query: filter by conversationId + implicit ownership via conversation.userId
    // Eliminates the separate getAuthorizedConversation round-trip
    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        conversation: { userId },
      },
      orderBy: { sequenceNo: "asc" },
    });

    // If empty AND conversation doesn't exist/belong to user → 404
    if (messages.length === 0) {
      const owns = await prisma.conversation.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!owns) {
        return createErrorResponse("RESOURCE_NOT_FOUND", "Percakapan tidak ditemukan.");
      }
    }

    console.log("[PERF MESSAGES]", {
      conversationId: id,
      queryMs: Math.round(performance.now() - t0),
      messageCount: messages.length,
    });

    return NextResponse.json({
      data: messages,
    });
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message);
    }
    if (error.name === "NotFoundError") {
      return createErrorResponse("RESOURCE_NOT_FOUND", error.message);
    }
    console.error("GET messages error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal memuat pesan percakapan.");
  }
}
