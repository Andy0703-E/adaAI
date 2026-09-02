import { auth } from "./auth";
import { prisma } from "../db/prisma";
import { Conversation, UserSettings } from "@prisma/client";
import { logAuditEvent } from "../logger/audit";

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Returns the current authenticated session user ID or throws AuthorizationError.
 */
export async function requireAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError("Sesi telah berakhir atau tidak valid.");
  }
  return session.user.id;
}

/**
 * Returns the optional authenticated session user ID (or null for guests).
 */
export async function getOptionalAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Verifies that a conversation exists and belongs to the given user.
 * Throws NotFoundError if not found or if owned by another user (preventing enumeration/IDOR).
 */
export async function getAuthorizedConversation(
  conversationId: string,
  userId: string,
  requestId?: string
): Promise<Conversation> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId: userId,
    },
  });

  if (!conversation) {
    // Check if the conversation actually exists under another user to log IDOR attempt
    try {
      const existsOtherUser = await prisma.conversation.findFirst({
        where: { id: conversationId },
        select: { id: true, userId: true },
      });

      if (existsOtherUser) {
        logAuditEvent({
          event: "RESOURCE_FORBIDDEN",
          requestId: requestId || crypto.randomUUID(),
          userId,
          metadata: { targetConversationId: conversationId },
        });
      }
    } catch (e) {
      // Ignore errors during audit check (e.g. invalid UUID format from malicious input)
    }

    throw new NotFoundError("Percakapan tidak ditemukan.");
  }

  return conversation;
}

/**
 * Retrieves the user settings for the given user, creating default if missing.
 */
export async function getAuthorizedUserSettings(userId: string): Promise<UserSettings> {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      theme: "DARK",
    },
  });
}
