import { describe, it, expect, vi } from "vitest";

// Mock auth before importing authorization module
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

import { getAuthorizedConversation, NotFoundError } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

describe("IDOR Protection & Authorization", () => {
  it("allows access when conversation belongs to authenticated user", async () => {
    const mockConv = {
      id: "conv-123",
      userId: "user-1",
      title: "Chat User 1",
      status: "ACTIVE",
      providerKey: "bandel",
      modelId: "auto",
      systemPrompt: null,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.conversation, "findFirst").mockResolvedValueOnce(mockConv as any);

    const result = await getAuthorizedConversation("conv-123", "user-1");
    expect(result.id).toBe("conv-123");
    expect(result.userId).toBe("user-1");
  });

  it("throws NotFoundError (preventing IDOR) when user attempts to access another user's conversation", async () => {
    vi.spyOn(prisma.conversation, "findFirst").mockResolvedValueOnce(null);

    await expect(
      getAuthorizedConversation("conv-123", "attacker-user-2")
    ).rejects.toThrow(NotFoundError);
  });
});
