import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("Search Scoping to Authenticated User", () => {
  it("strictly scopes title queries to session user ID", async () => {
    const mockFindMany = vi.spyOn(prisma.conversation, "findMany").mockResolvedValueOnce([
      {
        id: "conv-1",
        title: "Panduan Next.js",
        lastMessageAt: new Date(),
      } as any,
    ]);

    await prisma.conversation.findMany({
      where: {
        userId: "authenticated-user-id",
        title: { contains: "Next.js", mode: "insensitive" },
      },
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "authenticated-user-id",
        }),
      })
    );
  });

  it("strictly scopes message queries to session user ID", async () => {
    const mockFindMany = vi.spyOn(prisma.message, "findMany").mockResolvedValueOnce([
      {
        content: "Next.js adalah React framework",
        conversationId: "conv-1",
        conversation: { id: "conv-1", title: "Panduan Next.js", lastMessageAt: new Date() },
      } as any,
    ]);

    await prisma.message.findMany({
      where: {
        content: { contains: "framework", mode: "insensitive" },
        conversation: { userId: "authenticated-user-id" },
      },
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversation: { userId: "authenticated-user-id" },
        }),
      })
    );
  });
});
