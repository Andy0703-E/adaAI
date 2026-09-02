import { AppErrorCode } from "./ai";

export interface ApiErrorResponse {
  error: {
    code: AppErrorCode;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface AuthenticatedChatRequestBody {
  conversationId: string;
  content: string;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GuestChatRequestBody {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  lastMessageAt: string | null;
  snippet?: string;
  matchedIn: "title" | "content";
}
