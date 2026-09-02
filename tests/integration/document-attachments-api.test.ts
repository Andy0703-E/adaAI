import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    conversation: {
      findFirst: vi.fn(),
    },
    documentAttachment: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/documents/parser", () => ({
  parseDocument: vi.fn(),
}));

import { POST } from "@/app/api/v1/conversations/[id]/attachments/route";

describe("Document attachment API auth gate", () => {
  it("returns JSON 401 for unauthenticated requests", async () => {
    const response = await POST(new Request("http://localhost/api/v1/conversations/conv-1/attachments", { method: "POST" }), {
      params: Promise.resolve({ id: "conv-1" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toMatchObject({
      error: "UNAUTHORIZED",
      message: "Unauthorized",
      requestId: expect.any(String),
    });
  });
});
