import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks to bypass next-auth/next/server module resolution issues in Vitest
vi.mock("next-auth", () => ({
  default: () => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn().mockResolvedValue({ user: { id: "user-a", email: "a@example.com" } }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-a", email: "a@example.com" } }),
}));

import { prisma } from "@/lib/db/prisma";
import { getAuthorizedConversation, NotFoundError } from "@/lib/auth/authorization";
import { rateLimit } from "@/lib/rate-limit";
import { resetRedisClientForTesting } from "@/lib/rate-limit/redis";

describe("E2E Integration & Security Smoke Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    resetRedisClientForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetRedisClientForTesting();
  });

  describe("IDOR Isolation", () => {
    it("prevents User B from accessing User A's conversation", async () => {
      // Mock conversation existing for User A
      vi.spyOn(prisma.conversation, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.conversation, "findUnique").mockResolvedValueOnce({
        id: "conv-user-a",
        userId: "user-a",
        title: "User A Chat",
        status: "ACTIVE",
        modelId: "test-model",
        providerKey: "test-provider",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        systemPrompt: null,
      });

      // User B attempts access
      await expect(
        getAuthorizedConversation("conv-user-a", "user-b", "req-123")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("Rate Limiting", () => {
    it("returns 429 logic or safe fail-closed when limit is exceeded or redis unavailable", async () => {
      let result;
      for (let i = 0; i < 6; i++) {
        result = await rateLimit({ scope: "register", ip: "192.168.100.1" });
      }

      // If Redis is active it returns RATE_LIMIT_EXCEEDED, if inactive REDIS_UNAVAILABLE
      // Both map to an unallowed state preventing abuse
      expect(result?.allowed).toBe(false);
      expect(["RATE_LIMIT_EXCEEDED", "REDIS_UNAVAILABLE"]).toContain(result?.error);
    });
  });

  describe("Failure Simulation", () => {
    it("handles Redis failure gracefully based on policy", async () => {
      delete process.env.REDIS_URL;

      // Register is fail-closed
      const regResult = await rateLimit({ scope: "register", ip: "10.0.0.2" });
      expect(regResult.allowed).toBe(false);
      expect(regResult.error).toBe("REDIS_UNAVAILABLE");

      // Search is fail-open
      const searchResult = await rateLimit({ scope: "search", userId: "usr-1" });
      expect(searchResult.allowed).toBe(true);
    });
  });
});
