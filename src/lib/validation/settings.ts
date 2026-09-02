import { z } from "zod";

export const updateSettingsSchema = z.object({
  systemPrompt: z.string().max(8000).nullable().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
