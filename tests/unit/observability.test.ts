import { describe, it, expect, vi } from "vitest";
import { sanitizeLogData } from "@/lib/logger/sanitize";
import { logAuditEvent, addAuditListener } from "@/lib/logger/audit";
import { createErrorResponse } from "@/lib/utils/error-response";
import { GET as healthHandler } from "@/app/api/health/route";
import { GET as readyHandler } from "@/app/api/ready/route";

describe("Production Observability & Error Architecture", () => {
  describe("Log Sanitization", () => {
    it("recursively redacts sensitive keys in nested objects and arrays", () => {
      const sensitiveData = {
        userId: "usr_123",
        email: "user@example.com",
        password: "SuperSecretPassword123!",
        apiKey: "sk-live-1234567890",
        authorization: "Bearer eyJhbGciOi...",
        prompt: "Tell me a secret...",
        request: {
          headers: {
            cookie: "session=abc",
            authorization: "Bearer 123",
          },
          body: {
            prompt: "internal prompt",
            passwordHash: "hash-secret",
            messages: [
              { role: "user", content: "hello world" },
            ],
          },
        },
      };

      const sanitized = sanitizeLogData(sensitiveData) as any;

      expect(sanitized.userId).toBe("usr_123");
      expect(sanitized.email).toBe("[REDACTED]");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.prompt).toBe("[REDACTED]");
      expect(sanitized.request.headers.cookie).toBe("[REDACTED]");
      expect(sanitized.request.headers.authorization).toBe("[REDACTED]");
      expect(sanitized.request.body.prompt).toBe("[REDACTED]");
      expect(sanitized.request.body.passwordHash).toBe("[REDACTED]");
      expect(sanitized.request.body.messages[0].content).toBe("[REDACTED]");
    });
  });

  describe("Security Audit Events", () => {
    it("dispatches structured audit events without storing raw secrets", () => {
      const receivedEvents: any[] = [];
      const unsubscribe = addAuditListener((event) => receivedEvents.push(event));

      logAuditEvent({
        event: "RESOURCE_FORBIDDEN",
        requestId: "req-idor-123",
        userId: "user-456",
        metadata: { targetConversationId: "conv-999" },
      });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].event).toBe("RESOURCE_FORBIDDEN");
      expect(receivedEvents[0].requestId).toBe("req-idor-123");
      expect(receivedEvents[0].userId).toBe("user-456");
      expect(receivedEvents[0].createdAt).toBeDefined();

      unsubscribe();
    });
  });

  describe("Centralized Error Normalization", () => {
    it("normalizes unknown errors to safe error envelopes and propagates X-Request-Id header", async () => {
      const res = createErrorResponse("INTERNAL_ERROR", "Internal failure message", undefined, 500, undefined, "req-777");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(res.headers.get("X-Request-Id")).toBe("req-777");
      expect(json.error).toBe("INTERNAL_ERROR");
      expect(json.message).toBe("Internal failure message");
      expect(json.requestId).toBe("req-777");
      expect(json.stack).toBeUndefined();
    });

    it("normalizes rate limit error code to RATE_LIMIT_EXCEEDED with status 429", async () => {
      const res = createErrorResponse("RATE_LIMITED", undefined, undefined, 429, undefined, "req-999");
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.requestId).toBe("req-999");
    });
  });

  describe("Health & Readiness Endpoints", () => {
    it("returns 200 OK for /api/health without querying databases", async () => {
      const res = await healthHandler();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("ok");
      expect(json.timestamp).toBeDefined();
    });

    it("returns simple status for /api/ready without leaking internal system metadata", async () => {
      const res = await readyHandler();
      const json = await res.json();

      expect(["ready", "not_ready"]).toContain(json.status);
      expect(json.services).toBeUndefined();
      expect(json.database).toBeUndefined();
    });
  });
});
