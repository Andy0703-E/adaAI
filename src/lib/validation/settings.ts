import { z } from "zod";

export const updateSettingsSchema = z.object({
  defaultModelId: z.string().trim().max(200).nullable().optional(),
  defaultProviderKey: z.string().trim().max(80).nullable().optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxOutputTokens: z.number().int().positive().nullable().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
