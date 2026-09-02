import { z } from "zod";

export const authenticatedChatSchema = z.object({
  conversationId: z.string().uuid("ID percakapan tidak valid."),
  content: z
    .string()
    .trim()
    .min(1, "Pesan tidak boleh kosong.")
    .max(65536, "Panjang pesan melebihi batas 64 KB."),
  modelId: z.string().trim().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});

export const guestMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z
    .string()
    .max(65536, "Panjang pesan melebihi batas 64 KB."),
});

export const guestChatSchema = z.object({
  messages: z
    .array(guestMessageSchema)
    .min(1, "Daftar pesan tidak boleh kosong.")
    .max(50, "Maksimal 50 pesan riwayat untuk sesi tamu.")
    .refine((msgs) => msgs[msgs.length - 1].role === "user", {
      message: "Pesan terakhir harus berasal dari pengguna.",
    })
    .refine(
      (msgs) => {
        const totalLength = msgs.reduce((acc, m) => acc + m.content.length, 0);
        return totalLength <= 262144; // 256 KB max total content
      },
      {
        message: "Total ukuran percakapan melebihi batas 256 KB.",
      }
    ),
  modelId: z.string().trim().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});

export type AuthenticatedChatInput = z.infer<typeof authenticatedChatSchema>;
export type GuestChatInput = z.infer<typeof guestChatSchema>;
