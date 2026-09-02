import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId, getAuthorizedConversation } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { updateConversationSchema } from "@/lib/validation/conversation";
import { createErrorResponse } from "@/lib/utils/error-response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const userId = await requireAuthUserId();
    const { id } = await params;

    const conversation = await getAuthorizedConversation(id, userId, requestId);

    return NextResponse.json(
      {
        data: conversation,
      },
      {
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message, undefined, 401, undefined, requestId);
    }
    if (error.name === "NotFoundError") {
      return createErrorResponse("NOT_FOUND", error.message, undefined, 404, undefined, requestId);
    }
    console.error("GET conversation by id error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal memuat percakapan.", undefined, 500, undefined, requestId);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const userId = await requireAuthUserId();
    const { id } = await params;

    // Verify ownership
    await getAuthorizedConversation(id, userId, requestId);

    const body = await req.json().catch(() => ({}));
    const parse = updateConversationSchema.safeParse(body);

    if (!parse.success) {
      return createErrorResponse("VALIDATION_FAILED", "Data pembaruan tidak valid.", parse.error.format(), 400, undefined, requestId);
    }

    const { title, status, systemPrompt, modelId } = parse.data;

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(status ? { status } : {}),
        ...(systemPrompt !== undefined ? { systemPrompt } : {}),
        ...(modelId ? { modelId } : {}),
      },
    });

    return NextResponse.json(
      {
        data: updated,
      },
      {
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message, undefined, 401, undefined, requestId);
    }
    if (error.name === "NotFoundError") {
      return createErrorResponse("NOT_FOUND", error.message, undefined, 404, undefined, requestId);
    }
    console.error("PATCH conversation error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal memperbarui percakapan.", undefined, 500, undefined, requestId);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const userId = await requireAuthUserId();
    const { id } = await params;

    // Verify ownership
    await getAuthorizedConversation(id, userId, requestId);

    // Hard delete - cascades messages
    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        data: {
          id,
          deleted: true,
          message: "Percakapan berhasil dihapus secara permanen.",
        },
      },
      {
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message, undefined, 401, undefined, requestId);
    }
    if (error.name === "NotFoundError") {
      return createErrorResponse("NOT_FOUND", error.message, undefined, 404, undefined, requestId);
    }
    console.error("DELETE conversation error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal menghapus percakapan.", undefined, 500, undefined, requestId);
  }
}
