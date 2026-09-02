/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { ConversationList } from "@/components/sidebar/conversation-list";
import {
  conversationsQueryKey,
  prependActiveConversationToCache,
  removeConversationFromSidebarCaches,
  syncConversationInSidebarCaches,
} from "@/lib/conversations/cache";
import type { Conversation } from "@/types/chat";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("conversation sidebar cache", () => {
  it("adds a new conversation to the ACTIVE sidebar cache without a refetch", () => {
    const queryClient = new QueryClient();
    const activeKey = conversationsQueryKey("ACTIVE", "user-1");
    const fetchQuerySpy = vi.spyOn(queryClient, "fetchQuery");
    const newConversation: Conversation = {
      id: "conversation-1",
      userId: "user-1",
      title: "Chat baru",
      status: "DRAFT",
      providerKey: "bandel",
      modelId: "deepseek-v4-flash",
      lastMessageAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData<Conversation[]>(activeKey, []);
    prependActiveConversationToCache(queryClient, "user-1", newConversation);

    const cachedConversations = queryClient.getQueryData<Conversation[]>(activeKey);
    expect(cachedConversations).toEqual([newConversation]);
    expect(fetchQuerySpy).not.toHaveBeenCalled();

    render(
      <ConversationList
        conversations={cachedConversations ?? []}
        onRename={async () => {}}
        onArchive={async () => {}}
        onDelete={async () => {}}
      />,
    );

    expect(screen.getByText("Chat baru")).not.toBeNull();
  });

  it("moves archive and restore events between loaded caches, then removes deleted items", () => {
    const queryClient = new QueryClient();
    const activeKey = conversationsQueryKey("ACTIVE", "user-1");
    const archivedKey = conversationsQueryKey("ARCHIVED", "user-1");
    const fetchQuerySpy = vi.spyOn(queryClient, "fetchQuery");
    const activeConversation: Conversation = {
      id: "conversation-2",
      userId: "user-1",
      title: "Chat aktif",
      status: "ACTIVE",
      providerKey: "bandel",
      modelId: "deepseek-v4-flash",
      lastMessageAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData<Conversation[]>(activeKey, [activeConversation]);
    queryClient.setQueryData<Conversation[]>(archivedKey, []);

    const archivedConversation = { ...activeConversation, status: "ARCHIVED" as const };
    syncConversationInSidebarCaches(queryClient, "user-1", archivedConversation);
    expect(queryClient.getQueryData<Conversation[]>(activeKey)).toEqual([]);
    expect(queryClient.getQueryData<Conversation[]>(archivedKey)).toEqual([archivedConversation]);

    const restoredConversation = { ...archivedConversation, status: "ACTIVE" as const };
    syncConversationInSidebarCaches(queryClient, "user-1", restoredConversation);
    expect(queryClient.getQueryData<Conversation[]>(activeKey)).toEqual([restoredConversation]);
    expect(queryClient.getQueryData<Conversation[]>(archivedKey)).toEqual([]);

    removeConversationFromSidebarCaches(queryClient, "user-1", restoredConversation.id);
    expect(queryClient.getQueryData<Conversation[]>(activeKey)).toEqual([]);
    expect(queryClient.getQueryData<Conversation[]>(archivedKey)).toEqual([]);
    expect(fetchQuerySpy).not.toHaveBeenCalled();
  });
});
