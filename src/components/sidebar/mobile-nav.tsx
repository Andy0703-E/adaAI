"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useConversations } from "@/hooks/use-conversations";
import { ConversationList } from "./conversation-list";
import { SearchDialog } from "./search-dialog";
import { Button } from "../ui/button";
import {
  Menu,
  X,
  Plus,
  Search,
  Settings,
  LogOut,
  LogIn,
  Archive,
  MessageSquare,
} from "lucide-react";
import { Badge } from "../ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: session } = useSession();
  const isAuth = Boolean(session?.user?.id);
  const pathname = usePathname();

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

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
        aria-label="Buka menu navigasi"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex flex-col w-[80%] max-w-[320px] bg-background border-r border-border h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center font-bold text-sm">
                <div className="brand-mark flex h-7 w-7 items-center justify-center rounded-lg">
                  <img src="/adaai-robot.jpg" alt="AdaAI" />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-9 w-9 min-h-[44px] min-w-[44px]"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
              <Link href="/" onClick={() => setOpen(false)} className="block">
                <Button className="w-full justify-start gap-2 h-11 text-sm font-semibold">
                  <Plus className="h-4 w-4" />
                  <span>Chat Baru</span>
                </Button>
              </Link>

              {isAuth ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setSearchOpen(true);
                  }}
                  className="w-full justify-start gap-2 h-11 text-xs text-muted-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span>Cari percakapan...</span>
                </Button>
              ) : (
                <div className="px-3 py-2 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center justify-between">
                  <span>Sesi Tamu</span>
                  <Badge variant="outline" className="text-[10px]">
                    Sementara
                  </Badge>
                </div>
              )}
            </div>

            {/* Tabs */}
            {isAuth && (
              <div className="flex items-center gap-2 px-4 pb-2 text-xs">
                <button
                  onClick={() => setActiveTab("ACTIVE")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
                    activeTab === "ACTIVE"
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Percakapan</span>
                </button>
                <button
                  onClick={() => setActiveTab("ARCHIVED")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
                    activeTab === "ARCHIVED"
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>Arsip</span>
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Memuat...
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  activeId={activeConversationId}
                  onRename={handleRename}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-card/60">
              {isAuth ? (
                <div className="flex items-center justify-between">
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 overflow-hidden flex-1"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-semibold truncate">{session?.user?.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email}</p>
                    </div>
                  </Link>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="h-10 w-10 text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
                    aria-label="Keluar"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link href="/login" onClick={() => setOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full h-10 text-xs">
                      Masuk
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="flex-1">
                    <Button className="w-full h-10 text-xs">Daftar</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
