/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React, { useEffect } from "react";
import ChatLayout from "@/app/(chat)/layout";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "u1", name: "User" } },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({
    theme: "DARK",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-conversations", () => ({
  useConversations: () => ({
    conversations: [
      { id: "c1", title: "Chat 1", status: "ACTIVE", createdAt: new Date().toISOString() },
    ],
    isLoading: false,
    updateConversation: { mutateAsync: vi.fn() },
    deleteConversation: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/c1",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Persistent Chat Layout", () => {
  it("keeps Sidebar mounted when child content transitions", () => {
    const mountSpy = vi.fn();
    const unmountSpy = vi.fn();

    function ChatAPage() {
      useEffect(() => {
        mountSpy("ChatA");
        return () => unmountSpy("ChatA");
      }, []);
      return <div data-testid="chat-a">Chat A Content</div>;
    }

    function ChatBPage() {
      useEffect(() => {
        mountSpy("ChatB");
        return () => unmountSpy("ChatB");
      }, []);
      return <div data-testid="chat-b">Chat B Content</div>;
    }

    const { rerender } = render(
      <ChatLayout>
        <ChatAPage />
      </ChatLayout>
    );

    expect(screen.getByTestId("sidebar-desktop-expanded")).not.toBeNull();
    expect(screen.getByTestId("chat-a")).not.toBeNull();
    expect(mountSpy).toHaveBeenCalledWith("ChatA");

    // Transition from Chat A to Chat B in shared layout
    rerender(
      <ChatLayout>
        <ChatBPage />
      </ChatLayout>
    );

    expect(screen.queryByTestId("chat-a")).toBeNull();
    expect(screen.getByTestId("chat-b")).not.toBeNull();
    expect(unmountSpy).toHaveBeenCalledWith("ChatA");
    expect(mountSpy).toHaveBeenCalledWith("ChatB");

    // Sidebar remains mounted without unmounting
    expect(screen.getByTestId("sidebar-desktop-expanded")).not.toBeNull();
  });
});
