import type { QueryClient } from "@tanstack/react-query";
import type { Conversation, ConversationStatus } from "@/types/chat";

export const conversationsQueryKey = (
  status: ConversationStatus | undefined,
  userId: string | undefined,
) => ["conversations", status ?? "ACTIVE", userId ?? "guest"] as const;

const sidebarStatuses = ["ACTIVE", "ARCHIVED"] as const;

/** Add a newly created chat to the same ACTIVE cache read by the sidebar. */
export function prependActiveConversationToCache(
  queryClient: QueryClient,
  userId: string | undefined,
  newConversation: Conversation,
) {
  queryClient.setQueryData<Conversation[]>(
    conversationsQueryKey("ACTIVE", userId),
    (old) => [
      newConversation,
      ...(old ?? []).filter((conversation) => conversation.id !== newConversation.id),
    ],
  );
}

/**
 * Keep any already-loaded sidebar lists in sync after a rename, archive, or
 * restore. Unloaded lists are intentionally left alone so they can fetch their
 * complete server-side history when first opened.
 */
export function syncConversationInSidebarCaches(
  queryClient: QueryClient,
  userId: string | undefined,
  conversation: Conversation,
) {
  for (const status of sidebarStatuses) {
    queryClient.setQueryData<Conversation[]>(
      conversationsQueryKey(status, userId),
      (old) => {
        if (!old) return old;

        if (conversation.status !== status) {
          return old.filter((item) => item.id !== conversation.id);
        }

        return [
          conversation,
          ...old.filter((item) => item.id !== conversation.id),
        ];
      },
    );
  }
}

/** Remove a conversation from every already-loaded sidebar list. */
export function removeConversationFromSidebarCaches(
  queryClient: QueryClient,
  userId: string | undefined,
  conversationId: string,
) {
  for (const status of sidebarStatuses) {
    queryClient.setQueryData<Conversation[]>(
      conversationsQueryKey(status, userId),
      (old) => old?.filter((conversation) => conversation.id !== conversationId),
    );
  }
}
