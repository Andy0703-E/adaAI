"use client";

import React, { useMemo } from "react";
import { Conversation } from "@/types/chat";
import { ConversationItem } from "./conversation-item";

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onArchive: (id: string, isArchived: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectConversation?: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onRename,
  onArchive,
  onDelete,
  onSelectConversation,
}: ConversationListProps) {
  const groups = useMemo(() => {
    const today: Conversation[] = [];
    const past7Days: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    for (const c of conversations) {
      const time = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : new Date(c.createdAt).getTime();
      if (time >= startOfToday) {
        today.push(c);
      } else if (time >= startOf7DaysAgo) {
        past7Days.push(c);
      } else {
        older.push(c);
      }
    }

    return { today, past7Days, older };
  }, [conversations]);

  if (conversations.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        Belum ada riwayat percakapan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.today.length > 0 && (
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Hari Ini
          </div>
          {groups.today.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeId}
              onRename={onRename}
              onArchive={onArchive}
              onDelete={onDelete}
              onSelect={onSelectConversation}
            />
          ))}
        </div>
      )}

      {groups.past7Days.length > 0 && (
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            7 Hari Terakhir
          </div>
          {groups.past7Days.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeId}
              onRename={onRename}
              onArchive={onArchive}
              onDelete={onDelete}
              onSelect={onSelectConversation}
            />
          ))}
        </div>
      )}

      {groups.older.length > 0 && (
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Lebih Lama
          </div>
          {groups.older.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeId}
              onRename={onRename}
              onArchive={onArchive}
              onDelete={onDelete}
              onSelect={onSelectConversation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
