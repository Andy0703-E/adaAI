import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hashIdentifier, hashIp, buildRateLimitKey } from "@/lib/rate-limit/keys";
import { rateLimit } from "@/lib/rate-limit";
import { resetRedisClientForTesting } from "@/lib/rate-limit/redis";

describe("Distributed Rate Limiter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    resetRedisClientForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetRedisClientForTesting();
  });

  describe("Key Generation & Hashing", () => {
    it("hashes identifiers consistently with full 64-char sha256 hex", () => {
      const ip = "192.168.1.100";
      const hash1 = hashIp(ip);
      const hash2 = hashIdentifier(ip);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).not.toContain("192.168.1.100");
    });

    it("builds user-scoped key when userId is present", () => {
      const key = buildRateLimitKey({
        scope: "chat",
        userId: "user-123",
        ip: "10.0.0.1",
      });
      expect(key).toBe("rate:user:user-123:chat");
    });

    it("builds login key with hashed email/identifier", () => {
      const email = "User.Test@Example.COM";
      const key = buildRateLimitKey({
        scope: "login",
        identifier: email,
      });
      const expectedHash = hashIdentifier(email);
      expect(key).toBe(`rate:login:${expectedHash}`);
      expect(key).not.toContain("User.Test");
      expect(expectedHash).toHaveLength(64);
    });

    it("builds ip-scoped key with hashed IP when userId is missing", () => {
      const ip = "203.0.113.195";
      const key = buildRateLimitKey({
        scope: "register",
        ip,
      });
      const expectedHash = hashIp(ip);
      expect(key).toBe(`rate:ip:${expectedHash}:register`);
    });
  });

  describe("Fallback Behavior (Without Redis)", () => {
    it("fails closed on high-risk scopes (register, chat, login) when Redis is not configured", async () => {
      delete process.env.REDIS_URL;

      const registerResult = await rateLimit({
        scope: "register",
        ip: "127.0.0.1",
      });
      expect(registerResult.allowed).toBe(false);
      expect(registerResult.error).toBe("REDIS_UNAVAILABLE");

      const chatResult = await rateLimit({
        scope: "chat",
        userId: "user-abc",
      });
      expect(chatResult.allowed).toBe(false);
      expect(chatResult.error).toBe("REDIS_UNAVAILABLE");
    });

    it("fails open on low-risk read/search scopes (search, conversation_create) when Redis is not configured", async () => {
      delete process.env.REDIS_URL;

      const searchResult = await rateLimit({
        scope: "search",
        userId: "user-abc",
      });
      expect(searchResult.allowed).toBe(true);
      expect(searchResult.remaining).toBe(30);

      const convCreateResult = await rateLimit({
        scope: "conversation_create",
        userId: "user-abc",
      });
      expect(convCreateResult.allowed).toBe(true);
      expect(convCreateResult.remaining).toBe(20);
    });
  });
});
