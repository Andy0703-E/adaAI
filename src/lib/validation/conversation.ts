import { z } from "zod";

export const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200, "Judul maksimal 200 karakter.")
    .optional()
    .default("New Chat"),
  modelId: z.string().trim().max(200).optional(),
  systemPrompt: z
    .string()
    .max(8000, "System prompt maksimal 8000 karakter.")
    .optional(),
});

export const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul tidak boleh kosong.")
    .max(200, "Judul maksimal 200 karakter.")
    .optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  systemPrompt: z
    .string()
    .max(8000, "System prompt maksimal 8000 karakter.")
    .nullable()
    .optional(),
  modelId: z.string().trim().max(200).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
