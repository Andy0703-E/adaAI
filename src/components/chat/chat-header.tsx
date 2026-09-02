"use client";

import React from "react";
import { Button } from "../ui/button";
import { Plus, AlertTriangle, Menu } from "lucide-react";
import Link from "next/link";
import { useChatLayout } from "./chat-layout-context";

interface ChatHeaderProps {
  title?: string;
  onOpenMobileSidebar?: () => void;
  errorBanner?: string | null;
}

export function ChatHeader({
  title = "Chat Baru",
  onOpenMobileSidebar: propOnOpenMobileSidebar,
  errorBanner,
}: ChatHeaderProps) {
  const layout = useChatLayout();
  const onOpenMobileSidebar = propOnOpenMobileSidebar ?? layout.openMobileSidebar;
  return (
    <header
      data-testid="chat-header"
      className="skeu-chat-header sticky top-0 z-10 flex flex-col shrink-0"
    >
      <div className="flex h-14 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Mobile drawer toggle */}
          <Button
            data-testid="mobile-sidebar-toggle"
            variant="ghost"
            size="icon"
            onClick={onOpenMobileSidebar}
            className="lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Buka navigasi sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span
            className="text-xs sm:text-sm font-bold tracking-wide truncate max-w-[140px] sm:max-w-[280px]"
            title={title}
          >
            {title}
          </span>
        </div>

        <Link href="/" className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Chat baru"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{errorBanner}</span>
        </div>
      )}
    </header>
  );
}
