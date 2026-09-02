import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation/auth";
import { authenticatedChatSchema, guestChatSchema } from "@/lib/validation/chat";
import { createConversationSchema, updateConversationSchema } from "@/lib/validation/conversation";
import { updateSettingsSchema } from "@/lib/validation/settings";

describe("Validation Schemas", () => {
  describe("Auth Validation", () => {
    it("validates successful registration", () => {
      const valid = registerSchema.safeParse({
        name: "Budi Santoso",
        email: "Budi@Example.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe("budi@example.com"); // normalized lowercase
      }
    });

    it("rejects mismatched confirm password", () => {
      const result = registerSchema.safeParse({
        name: "Budi",
        email: "budi@example.com",
        password: "password123",
        confirmPassword: "wrongpassword",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password shorter than 8 chars", () => {
      const result = registerSchema.safeParse({
        name: "Budi",
        email: "budi@example.com",
        password: "short",
        confirmPassword: "short",
      });
      expect(result.success).toBe(false);
    });

    it("validates login schema", () => {
      const valid = loginSchema.safeParse({
        email: "user@test.com",
        password: "secretpassword",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Chat Validation", () => {
    it("validates authenticated chat with valid UUID and content", () => {
      const valid = authenticatedChatSchema.safeParse({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        content: "Halo AI",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid conversation UUID in authenticated chat", () => {
      const result = authenticatedChatSchema.safeParse({
        conversationId: "invalid-uuid",
        content: "Halo AI",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty prompt in authenticated chat", () => {
      const result = authenticatedChatSchema.safeParse({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        content: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("validates guest chat messages", () => {
      const valid = guestChatSchema.safeParse({
        messages: [
          { role: "user", content: "Halo" },
        ],
      });
      expect(valid.success).toBe(true);
    });

    it("rejects guest chat if last message is not user", () => {
      const result = guestChatSchema.safeParse({
        messages: [
          { role: "user", content: "Halo" },
          { role: "assistant", content: "Hai" },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Conversation and Settings Validation", () => {
    it("validates create conversation", () => {
      const valid = createConversationSchema.safeParse({
        title: "Test Conversation",
        modelId: "auto",
      });
      expect(valid.success).toBe(true);
    });

    it("validates update conversation status", () => {
      const valid = updateConversationSchema.safeParse({
        status: "ARCHIVED",
      });
      expect(valid.success).toBe(true);
    });

    it("validates settings update with systemPrompt", () => {
      const valid = updateSettingsSchema.safeParse({
        systemPrompt: "Act as an expert",
      });
      expect(valid.success).toBe(true);
    });
  });
});
