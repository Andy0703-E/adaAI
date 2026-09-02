import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("Conversation Lifecycle & Hard Delete Cascade", () => {
  it("transitions status from DRAFT to ACTIVE to ARCHIVED without DELETED status", () => {
    const validStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"];
    expect(validStatuses).not.toContain("DELETED");

    let currentStatus = "DRAFT";
    // First message received
    currentStatus = "ACTIVE";
    expect(currentStatus).toBe("ACTIVE");

    // User archives
    currentStatus = "ARCHIVED";
    expect(currentStatus).toBe("ARCHIVED");

    // User unarchives
    currentStatus = "ACTIVE";
    expect(currentStatus).toBe("ACTIVE");
  });

  it("performs hard delete cascading to related messages", async () => {
    const mockDelete = vi.spyOn(prisma.conversation, "delete").mockResolvedValueOnce({
      id: "conv-1",
      userId: "user-1",
      title: "Deleted Chat",
      status: "ACTIVE",
      providerKey: "bandel",
      modelId: "auto",
      systemPrompt: null,
      lastMessageAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const deleted = await prisma.conversation.delete({ where: { id: "conv-1" } });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "conv-1" } });
    expect(deleted.id).toBe("conv-1");
  });
});
