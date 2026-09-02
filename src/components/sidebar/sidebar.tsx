"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useConversations } from "@/hooks/use-conversations";
import { ConversationList } from "./conversation-list";
import { Button } from "../ui/button";
import {
  Plus,
  Settings,
  LogOut,
  LogIn,
  Archive,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Badge } from "../ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChatLayout } from "../chat/chat-layout-context";

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  collapsed: propCollapsed,
  onToggleCollapse: propOnToggleCollapse,
  mobileOpen: propMobileOpen,
  onCloseMobile: propOnCloseMobile,
}: SidebarProps = {}) {
  const layout = useChatLayout();
  const collapsed = propCollapsed ?? layout.sidebarCollapsed;
  const onToggleCollapse = propOnToggleCollapse ?? layout.toggleSidebar;
  const mobileOpen = propMobileOpen ?? layout.mobileSidebarOpen;
  const onCloseMobile = propOnCloseMobile ?? layout.closeMobileSidebar;

  const { data: session } = useSession();
  const isAuth = Boolean(session?.user?.id);
  const pathname = usePathname();

  // Lifecycle log to verify persistence across chat routes
  useEffect(() => {
    console.log("[SIDEBAR MOUNT]");
    return () => {
      console.log("[SIDEBAR UNMOUNT]");
    };
  }, []);

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const {
    conversations,
    isLoading,
    updateConversation,
    deleteConversation,
  } = useConversations(activeTab);

  const activeConversationId = pathname.startsWith("/chat/")
    ? pathname.replace("/chat/", "")
    : undefined;

  const handleRename = async (id: string, newTitle: string) => {
    await updateConversation({ id, title: newTitle });
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    await updateConversation({
      id,
      status: isArchived ? "ARCHIVED" : "ACTIVE",
    });
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
  };

  // Lock body scroll when mobile drawer is open; restore on close or unmount
  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseMobile?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen, onCloseMobile]);

  // Shared internal sidebar view
  const renderSidebarContent = (isMobile: boolean) => (
    <div className="app-sidebar-panel flex flex-col h-dvh overflow-hidden">
      {/* Header: shrink-0 */}
      <div className="shrink-0 flex items-center justify-between p-3.5">
        <Link
          href="/"
          onClick={() => isMobile && onCloseMobile?.()}
          className="flex items-center gap-3 font-bold tracking-tight text-foreground"
        >
          <div className="brand-mark h-11 w-11 rounded-2xl">
            <img src="/adaai-robot.jpg" alt="AdaAI" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">AdaAI</span>
        </Link>
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Tutup navigasi sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="group h-9 w-9 rounded-xl border border-white/10 bg-[#182235] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_10px_rgba(0,0,0,0.28)] transition-all hover:border-white/15 hover:bg-[#1d2940] hover:text-[#6ea8ff] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_2px_8px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.22)] focus-visible:ring-2 focus-visible:ring-[#6ea8ff]/40 focus-visible:ring-offset-0 lg:h-9 lg:w-9"
            aria-label="Sembunyikan sidebar"
            title="Sembunyikan sidebar"
          >
            <PanelLeftClose className="h-[18px] w-[18px] stroke-[1.9] transition-transform group-hover:scale-[1.03]" />
          </Button>
        )}
      </div>

      {/* New chat control: shrink-0 */}
      <div className="shrink-0 p-3 space-y-2">
        <Link
          href="/"
          onClick={() => isMobile && onCloseMobile?.()}
          className="block"
        >
          <Button className="w-full justify-start gap-2 h-10 px-3 text-xs font-bold tracking-wide">
            <Plus className="h-4 w-4" />
            <span>Chat Baru</span>
          </Button>
        </Link>

        {!isAuth && (
          <div className="px-2 py-1.5 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center justify-between">
            <span>Sesi Tamu</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Sementara
            </Badge>
          </div>
        )}
      </div>

      {/* Filter Tabs (Active vs Archived): shrink-0 */}
      {isAuth && (
        <div className="skeu-inset mx-3 mb-2 grid shrink-0 grid-cols-2 gap-1 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab("ACTIVE")}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
              activeTab === "ACTIVE"
                ? "bg-primary/15 text-primary border border-primary/25 shadow-[inset_1px_1px_0_hsl(0_0%_100%_/_0.08),0_2px_6px_hsl(230_50%_3%_/_0.32)] font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <MessageSquare className="h-3 w-3" />
            <span>Percakapan</span>
          </button>
          <button
            onClick={() => setActiveTab("ARCHIVED")}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
              activeTab === "ARCHIVED"
                ? "bg-primary/15 text-primary border border-primary/25 shadow-[inset_1px_1px_0_hsl(0_0%_100%_/_0.08),0_2px_6px_hsl(230_50%_3%_/_0.32)] font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Archive className="h-3 w-3" />
            <span>Arsip</span>
          </button>
        </div>
      )}

      {/* Conversation History Scroll Area: min-h-0 flex-1 overflow-y-auto */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Memuat riwayat...
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onRename={handleRename}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onSelectConversation={() => {
              if (isMobile) onCloseMobile?.();
            }}
          />
        )}
      </div>

      {/* Bottom account area: shrink-0 */}
      <div className="shrink-0 p-3">
        {isAuth ? (
          <div className="pt-1 flex items-center justify-between">
            <Link
              href="/settings"
              onClick={() => isMobile && onCloseMobile?.()}
              className="flex items-center gap-2 overflow-hidden flex-1 group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {session?.user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-foreground truncate group-hover:underline">
                  {session?.user?.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Keluar"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="pt-1 flex gap-2">
            <Link
              href="/login"
              onClick={() => isMobile && onCloseMobile?.()}
              className="flex-1"
            >
              <Button variant="outline" size="sm" className="w-full h-8 text-xs font-medium">
                Masuk
              </Button>
            </Link>
            <Link
              href="/register"
              onClick={() => isMobile && onCloseMobile?.()}
              className="flex-1"
            >
              <Button size="sm" className="w-full h-8 text-xs font-medium">
                Daftar
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer (viewport < lg) */}
      {mobileOpen && (
        <>
          {/* Backdrop: z-40 */}
          <div
            data-testid="sidebar-backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer: z-50 */}
          <aside
            data-testid="sidebar-drawer"
          className="app-sidebar-panel fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(320px,88vw)] flex-col overflow-hidden border-r border-border bg-background/0 shadow-2xl animate-in slide-in-from-left duration-200 lg:hidden"
            aria-label="Navigasi sidebar mobile"
          >
            {renderSidebarContent(true)}
          </aside>
        </>
      )}

      {/* Desktop Sidebar (viewport >= lg) */}
      {collapsed ? (
        <aside
          data-testid="sidebar-desktop-collapsed"
          className="app-sidebar-panel hidden lg:flex flex-col items-center justify-between w-14 border-r border-border py-3 px-1 h-dvh shrink-0 select-none"
        >
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="group h-9 w-9 rounded-xl border border-white/10 bg-[#182235] p-0 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_10px_rgba(0,0,0,0.28)] transition-all hover:border-white/15 hover:bg-[#1d2940] hover:text-[#6ea8ff] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_2px_8px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.22)] focus-visible:ring-2 focus-visible:ring-[#6ea8ff]/40 focus-visible:ring-offset-0 lg:h-9 lg:w-9"
              aria-label="Buka sidebar"
              title="Buka sidebar"
            >
              <PanelLeftOpen className="h-[18px] w-[18px] stroke-[1.9] transition-transform group-hover:scale-[1.03]" />
            </Button>

            <Link href="/">
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8 rounded-lg shadow-sm"
                aria-label="Chat baru"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-col items-center gap-2">
            {isAuth ? (
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Pengaturan"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Masuk"
                >
                  <LogIn className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </aside>
      ) : (
        <aside
          data-testid="sidebar-desktop-expanded"
          className="app-sidebar-panel hidden lg:flex h-dvh w-72 shrink-0 select-none border-r border-border bg-background/0 lg:flex-col"
        >
          {renderSidebarContent(false)}
        </aside>
      )}
    </>
  );
}
