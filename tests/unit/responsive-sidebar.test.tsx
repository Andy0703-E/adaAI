/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { Composer } from "@/components/chat/composer";
import { ChatMessages } from "@/components/chat/chat-messages";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { id: "user-1", name: "Andi Agung", email: "dadung2707@gmail.com" },
    },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/conv-1",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-conversations", () => ({
  useConversations: () => ({
    conversations: [
      {
        id: "conv-1",
        title: "Percakapan Penting PRD",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({
    theme: "DARK",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-models", () => ({
  useModels: () => ({
    models: [
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        ownedBy: "deepseek",
      },
    ],
    isLoading: false,
  }),
}));

describe("Responsive Sidebar & Z-Index Hierarchy", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
    vi.clearAllMocks();
  });

  describe("Mobile and Tablet Drawer Viewports (< 1024px)", () => {
    const viewports = [
      { name: "375px (Mobile SE)", width: 375 },
      { name: "430px (iPhone Pro Max)", width: 430 },
      { name: "768px (Tablet Portrait)", width: 768 },
    ];

    viewports.forEach(({ name }) => {
      it(`renders solid modal drawer with backdrop on ${name}`, () => {
        const onClose = vi.fn();
        render(
          <Sidebar
            collapsed={false}
            onToggleCollapse={vi.fn()}
            mobileOpen={true}
            onCloseMobile={onClose}
          />
        );

        const backdrop = screen.getByTestId("sidebar-backdrop");
        expect(backdrop).not.toBeNull();
        expect(backdrop.className).toContain("fixed inset-0");
        expect(backdrop.className).toContain("z-40");
        expect(backdrop.className).toContain("bg-black/60");

        const drawer = screen.getByTestId("sidebar-drawer");
        expect(drawer).not.toBeNull();
        expect(drawer.className).toContain("fixed inset-y-0 left-0");
        expect(drawer.className).toContain("z-50");
        expect(drawer.className).toContain("h-dvh");
        expect(drawer.className).toContain("bg-background");
        expect(drawer.className).toContain("overflow-hidden");

        // Body scroll lock must be active
        expect(document.body.style.overflow).toBe("hidden");

        // Clicking backdrop closes drawer
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it("restores body scroll when mobile sidebar is closed or unmounted", () => {
      const onClose = vi.fn();
      const { rerender, unmount } = render(
        <Sidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={true}
          onCloseMobile={onClose}
        />
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Sidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={false}
          onCloseMobile={onClose}
        />
      );
      expect(document.body.style.overflow).toBe("");

      rerender(
        <Sidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={true}
          onCloseMobile={onClose}
        />
      );
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });

    it("closes mobile drawer on Escape key press", () => {
      const onClose = vi.fn();
      render(
        <Sidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={true}
          onCloseMobile={onClose}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes the mobile drawer when a conversation history item is selected", () => {
      const onClose = vi.fn();
      render(
        <Sidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={true}
          onCloseMobile={onClose}
        />
      );

      fireEvent.click(
        within(screen.getByTestId("sidebar-drawer")).getByText("Percakapan Penting PRD"),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Desktop Viewports (>= 1024px)", () => {
    const desktopViewports = [
      { name: "1024px (Tablet Landscape / Desktop breakpoint)", width: 1024 },
      { name: "1440px (Desktop Wide)", width: 1440 },
    ];

    desktopViewports.forEach(({ name }) => {
      it(`renders static layout without modal drawer or backdrop on ${name}`, () => {
        render(
          <Sidebar
            collapsed={false}
            onToggleCollapse={vi.fn()}
            mobileOpen={false}
          />
        );

        // Backdrop and modal drawer must NOT exist
        expect(screen.queryByTestId("sidebar-backdrop")).toBeNull();
        expect(screen.queryByTestId("sidebar-drawer")).toBeNull();

        // Desktop expanded sidebar must exist with w-72 and bg-background
        const desktopSidebar = screen.getByTestId("sidebar-desktop-expanded");
        expect(desktopSidebar).not.toBeNull();
        expect(desktopSidebar.className).toContain("hidden lg:flex");
        expect(desktopSidebar.className).toContain("w-72");
        expect(desktopSidebar.className).toContain("bg-background");
      });

      it(`renders collapsed static sidebar on ${name} when collapsed=true`, () => {
        render(
          <Sidebar
            collapsed={true}
            onToggleCollapse={vi.fn()}
            mobileOpen={false}
          />
        );

        const collapsedSidebar = screen.getByTestId("sidebar-desktop-collapsed");
        expect(collapsedSidebar).not.toBeNull();
        expect(collapsedSidebar.className).toContain("hidden lg:flex");
        expect(collapsedSidebar.className).toContain("w-14");
      });
    });
  });

  describe("Z-Index Hierarchy Verification", () => {
    it("keeps the empty-state logo above the header while preserving drawer and composer layering", () => {
      const { container: headerContainer } = render(
        <ChatHeader
          title="Test"
          onOpenMobileSidebar={vi.fn()}
        />
      );

      const { container: composerContainer } = render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSend={vi.fn()}
          onStop={vi.fn()}
          isGenerating={false}
        />
      );

      const commonChatMessagesProps = {
        onSelectSuggestion: vi.fn(),
        onRegenerate: vi.fn(),
        onRetry: vi.fn(),
        editingMessageId: null,
        editInput: "",
        onEditChange: vi.fn(),
        onStartEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onSaveEdit: vi.fn(),
      };

      const { container: messagesContainer } = render(
        <ChatMessages
          messages={[]}
          isGenerating={false}
          generationStage="idle"
          activeModelId="deepseek-v4-flash"
          {...commonChatMessagesProps}
        />
      );

      const { container: sidebarContainer } = render(
        <Sidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={true}
          onCloseMobile={vi.fn()}
        />
      );

      const header = headerContainer.querySelector("[data-testid='chat-header']");
      const composer = composerContainer.querySelector("[data-testid='chat-composer']");
      const messages = messagesContainer.querySelector("[data-testid='chat-messages']");
      const backdrop = sidebarContainer.querySelector("[data-testid='sidebar-backdrop']");
      const drawer = sidebarContainer.querySelector("[data-testid='sidebar-drawer']");

      const emptyStateLogo = messagesContainer.querySelector("[data-testid='empty-state-logo']");
      expect(messages?.className).not.toContain("z-0");
      expect(emptyStateLogo?.className).toContain("z-20");
      expect(header?.className).toContain("z-10");
      expect(composer?.className).toContain("z-20");
      expect(backdrop?.className).toContain("z-40");
      expect(drawer?.className).toContain("z-50");
    });

    it("renders scroll-to-bottom button on Composer above textarea with z-30", () => {
      const onScrollToBottom = vi.fn();
      const { container } = render(
        <Composer
          value=""
          onChange={vi.fn()}
          onSend={vi.fn()}
          onStop={vi.fn()}
          isGenerating={false}
          showScrollBottom={true}
          onScrollToBottom={onScrollToBottom}
        />
      );

      const button = container.querySelector("[data-testid='scroll-to-bottom-button']");
      expect(button).not.toBeNull();
      const wrapper = button?.parentElement;
      expect(wrapper?.className).toContain("absolute");
      expect(wrapper?.className).toContain("-top-12");
      expect(wrapper?.className).toContain("left-1/2");
      expect(wrapper?.className).toContain("-translate-x-1/2");
      expect(wrapper?.className).toContain("z-30");

      if (button) fireEvent.click(button);
      expect(onScrollToBottom).toHaveBeenCalledTimes(1);
    });

    it("ensures scroll-to-bottom button uses relative absolute positioning above composer instead of fixed bottom-24", () => {
      const messages = [
        {
          id: "m1",
          conversationId: "conv-1",
          sequenceNo: 1,
          role: "USER" as const,
          content: "Halo AdaAI",
          status: "COMPLETED" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m2",
          conversationId: "conv-1",
          sequenceNo: 2,
          role: "ASSISTANT" as const,
          content: "Halo! Ada yang bisa dibantu?",
          status: "COMPLETED" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const { container } = render(
        <ChatMessages
          messages={messages}
          isGenerating={false}
          generationStage="idle"
          activeModelId="deepseek-v4-flash"
          onSelectSuggestion={vi.fn()}
          onRegenerate={vi.fn()}
          onRetry={vi.fn()}
          editingMessageId={null}
          editInput=""
          onEditChange={vi.fn()}
          onStartEdit={vi.fn()}
          onCancelEdit={vi.fn()}
          onSaveEdit={vi.fn()}
        />
      );

      const scrollEl = container.querySelector(".overflow-y-auto");
      expect(scrollEl).not.toBeNull();
      if (scrollEl) {
        Object.defineProperty(scrollEl, "scrollHeight", { value: 1000, configurable: true });
        Object.defineProperty(scrollEl, "clientHeight", { value: 300, configurable: true });
        Object.defineProperty(scrollEl, "scrollTop", { value: 100, configurable: true });
        fireEvent.scroll(scrollEl);
      }

      const scrollButton = container.querySelector("[data-testid='scroll-to-bottom-button']");
      expect(scrollButton).not.toBeNull();
      expect(scrollButton?.className).toContain("absolute");
      expect(scrollButton?.className).toContain("bottom-3");
      expect(scrollButton?.className).not.toContain("fixed");
      expect(scrollButton?.className).not.toContain("bottom-24");
    });
  });
});
