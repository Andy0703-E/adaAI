export type AppErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "MODEL_UNAVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "STREAM_MALFORMED"
  | "REQUEST_ABORTED"
  | "INTERNAL_ERROR";

export interface AIModel {
  id: string;
  name: string;
  isAvailable: boolean;
  providerKey: string;
  capabilities?: {
    text?: boolean;
    vision?: boolean;
    tools?: boolean;
    temperature?: boolean;
    [key: string]: unknown;
  };
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ChatMessagePayload {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessagePayload[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIProviderError extends Error {
  code: AppErrorCode;
  status?: number;
  retryable: boolean;
  retryAfterSeconds?: number;
  originalError?: unknown;
}

export interface AIProvider {
  listModels(signal?: AbortSignal): Promise<AIModel[]>;
  chat(request: ChatRequest, signal: AbortSignal): Promise<Response>;
  normalizeError(error: unknown): AIProviderError;
}
