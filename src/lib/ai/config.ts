import "server-only";
import { z } from "zod";

const envSchema = z.object({
  AI_BASE_URL: z.string().url().default("https://bandelbanget.xyz/v1"),
  AI_API_KEY: z.string().optional().default(""),
  AI_DEFAULT_MODEL: z.string().default("deepseek-v4-flash"),
  AI_MODELS_FALLBACK: z
    .string()
    .default(
      "hy3,kimi-k2.7-code,kimi-k2.7-code-highspeed,kimi-k3,mimo-v2.5-pro,minimax-m3,deepseek-v4-flash,deepseek-v4-flash-0731,deepseek-v4-flash-vision-exp,deepseek-v4-mod,deepseek-v4-pro,deepseek-v4-pro-0813,glm-5.1,glm-5.2,glm-5.3,glm-5.3-flash"
    ),
  AI_CHAT_PATH: z.string().default("/chat/completions"),
  AI_MODELS_PATH: z.string().default("/models"),
  AI_FIRST_BYTE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_STREAM_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AI_TOTAL_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(8192),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid AI environment variables:", parsedEnv.error.format());
  throw new Error("Invalid AI environment configuration.");
}

export const aiConfig = {
  baseUrl: parsedEnv.data.AI_BASE_URL.replace(/\/+$/, ""),
  apiKey: parsedEnv.data.AI_API_KEY,
  defaultModel: parsedEnv.data.AI_DEFAULT_MODEL,
  modelsFallback: parsedEnv.data.AI_MODELS_FALLBACK.split(",").map((s) => s.trim()).filter(Boolean),
  chatPath: parsedEnv.data.AI_CHAT_PATH.startsWith("/")
    ? parsedEnv.data.AI_CHAT_PATH
    : `/${parsedEnv.data.AI_CHAT_PATH}`,
  modelsPath: parsedEnv.data.AI_MODELS_PATH.startsWith("/")
    ? parsedEnv.data.AI_MODELS_PATH
    : `/${parsedEnv.data.AI_MODELS_PATH}`,
  firstByteTimeoutMs: parsedEnv.data.AI_FIRST_BYTE_TIMEOUT_MS,
  streamIdleTimeoutMs: parsedEnv.data.AI_STREAM_IDLE_TIMEOUT_MS,
  totalTimeoutMs: parsedEnv.data.AI_TOTAL_TIMEOUT_MS,
  maxOutputTokens: parsedEnv.data.AI_MAX_OUTPUT_TOKENS,
};
