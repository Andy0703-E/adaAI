"use client";

import React, { useState } from "react";
import { Conversation } from "@/types/chat";
import { MessageSquare, MoreHorizontal, Edit2, Archive, Trash2, Check, X, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onArchive: (id: string, isArchived: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelect?: (id: string) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onRename,
  onArchive,
  onDelete,
  onSelect,
}: ConversationItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(conversation.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveRename = async () => {
    if (!titleInput.trim()) return;
    await onRename(conversation.id, titleInput.trim());
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setTitleInput(conversation.title);
    setIsEditing(false);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(conversation.id);
      setShowDeleteDialog(false);
      if (isActive) {
        router.push("/");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-accent/50 rounded-lg">
        <Input
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveRename();
            if (e.key === "Escape") handleCancelRename();
          }}
          maxLength={200}
          className="h-7 text-xs px-1.5 bg-background focus-visible:ring-1"
          autoFocus
        />
        <Button size="icon" variant="ghost" onClick={handleSaveRename} className="h-6 w-6 shrink-0" aria-label="Simpan nama">
          <Check className="h-3 w-3 text-green-500" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancelRename} className="h-6 w-6 shrink-0" aria-label="Batal ubah nama">
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  const isArchived = conversation.status === "ARCHIVED";

  return (
    <>
      <div
        className={`skeu-conversation-item group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs ${
          isActive
            ? "skeu-conversation-item-active font-medium text-accent-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Link
          href={`/chat/${conversation.id}`}
          onClick={() => onSelect?.(conversation.id)}
          className="flex items-center gap-2 overflow-hidden flex-1 py-0.5"
          title={conversation.title}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate max-w-[170px]">{conversation.title}</span>
        </Link>

        {/* Context Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
              aria-label="Menu percakapan"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-2" />
              <span>Ubah Nama</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(conversation.id, !isArchived)}>
              {isArchived ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  <span>Batalkan Arsip</span>
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5 mr-2" />
                  <span>Arsipkan</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              <span>Hapus Permanen</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hard Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Percakapan?</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus percakapan <strong>&ldquo;{conversation.title}&rdquo;</strong> beserta
              seluruh riwayat pesannya secara permanen. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
