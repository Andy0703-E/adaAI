/**
 * @vitest-environment jsdom
 */
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "@/hooks/use-chat";

const { prependSpy } = vi.hoisted(() => ({ prependSpy: vi.fn() }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } }, status: "authenticated" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/conversations/cache", () => ({
  prependActiveConversationToCache: prependSpy,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const conversation = {
  id: "conversation-new",
  userId: "user-1",
  title: "New Chat",
  status: "DRAFT",
  providerKey: "bandel",
  modelId: "deepseek-v4-flash",
  lastMessageAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("useChat conversation preparation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    prependSpy.mockReset();
    window.history.replaceState(null, "", "/");
  });

  it("deduplicates concurrent creation and synchronizes the sidebar cache", async () => {
    let resolveCreate!: (value: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChat({}), { wrapper });

    let first!: Promise<string | null>;
    let second!: Promise<string | null>;
    act(() => {
      first = result.current.createConversation();
      second = result.current.createConversation();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ ok: true, json: async () => ({ data: conversation }) });
    });
    await expect(first).resolves.toBe(conversation.id);
    await expect(second).resolves.toBe(conversation.id);
    expect(prependSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(`/chat/${conversation.id}`);
  });

  it("reuses attachment-created conversation when Send runs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: conversation }) })
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({ start(controller) { controller.close(); } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChat({}), { wrapper });

    await act(async () => {
      await result.current.createConversation();
      result.current.setInput("Ringkas dokumen");
    });
    await act(async () => {
      await result.current.sendMessage(undefined, undefined, ["attachment-1"]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/conversations");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/chat");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      conversationId: conversation.id,
      attachmentIds: ["attachment-1"],
    });
  });

  it("keeps normal New Chat Send creation unchanged", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: conversation }) })
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({ start(controller) { controller.close(); } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChat({}), { wrapper });

    await act(async () => result.current.setInput("Pesan biasa"));
    await act(async () => result.current.sendMessage());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("attachmentIds");
  });
});
