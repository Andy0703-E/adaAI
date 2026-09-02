export type ConversationStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type MessageRole = "SYSTEM" | "USER" | "ASSISTANT";

export type MessageStatus = "PENDING" | "STREAMING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type Theme = "LIGHT" | "DARK" | "SYSTEM";

export interface Message {
  id: string;
  conversationId: string;
  sequenceNo: number;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  providerKey?: string | null;
  modelId?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  finishReason?: string | null;
  errorCode?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  providerKey: string;
  modelId: string;
  systemPrompt?: string | null;
  lastMessageAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  messages?: Message[];
}

export interface UserSettings {
  id: string;
  userId: string;
  defaultProviderKey?: string | null;
  defaultModelId?: string | null;
  systemPrompt?: string | null;
  temperature?: number | null;
  maxOutputTokens?: number | null;
  theme: Theme;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface GuestConversation {
  id: string;
  title: string;
  modelId: string;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    status: MessageStatus;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
