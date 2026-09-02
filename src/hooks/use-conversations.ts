import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Conversation, ConversationStatus } from "@/types/chat";
import { useSession } from "next-auth/react";
import {
  conversationsQueryKey,
  prependActiveConversationToCache,
  removeConversationFromSidebarCaches,
  syncConversationInSidebarCaches,
} from "@/lib/conversations/cache";

export function useConversations(status?: ConversationStatus) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuth = Boolean(session?.user?.id);

  const queryKey = conversationsQueryKey(status, session?.user?.id);

  const query = useQuery<Conversation[]>({
    queryKey,
    enabled: isAuth,
    // 5 minutes: sidebar history does NOT refetch on every navigation within (chat) layout.
    // Refetches only when stale AND window is re-focused, or when a mutation explicitly invalidates.
    staleTime: 5 * 60 * 1000,
    // Keep previous data while revalidating — no flash to empty list
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const url = status
        ? `/api/v1/conversations?status=${status}`
        : `/api/v1/conversations`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Gagal mengambil percakapan");
      }
      const json = await res.json();
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { title?: string; modelId?: string }) => {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Gagal membuat percakapan");
      const json = await res.json();
      return json.data as Conversation;
    },
    onSuccess: (newConversation) => {
      prependActiveConversationToCache(queryClient, session?.user?.id, newConversation);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      status: newStatus,
      modelId,
    }: {
      id: string;
      title?: string;
      status?: "ACTIVE" | "ARCHIVED";
      modelId?: string;
    }) => {
      const res = await fetch(`/api/v1/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: newStatus, modelId }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui percakapan");
      const json = await res.json();
      return json.data as Conversation;
    },
    onSuccess: (updated) => {
      syncConversationInSidebarCaches(queryClient, session?.user?.id, updated);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus percakapan");
      return id;
    },
    onSuccess: (deletedId) => {
      removeConversationFromSidebarCaches(queryClient, session?.user?.id, deletedId);
    },
  });

  /**
   * Call this after a new message is sent to bump a conversation to the top
   * of the sidebar list without a full GET /conversations refetch.
   */
  function bumpConversationToTop(id: string) {
    queryClient.setQueryData<Conversation[]>(queryKey, (old) => {
      if (!old) return old;
      const idx = old.findIndex((c) => c.id === id);
      if (idx <= 0) return old; // already at top or not found
      const updated = [...old];
      const [item] = updated.splice(idx, 1);
      return [{ ...item, lastMessageAt: new Date().toISOString() } as Conversation, ...updated];
    });
  }

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createConversation: createMutation.mutateAsync,
    updateConversation: updateMutation.mutateAsync,
    deleteConversation: deleteMutation.mutateAsync,
    bumpConversationToTop,
    refetch: query.refetch,
  };
}
