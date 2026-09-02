"use client";

import React, { useRef, useEffect, useState } from "react";
import { Message } from "@/types/chat";
import { GenerationStage } from "@/hooks/use-chat";
import { MessageItem } from "./message-item";
import { EmptyState } from "./empty-state";
import { ArrowDown } from "lucide-react";
import { Button } from "../ui/button";

interface ChatMessagesProps {
  messages: Message[];
  isGenerating: boolean;
  generationStage?: GenerationStage;
  activeModelId?: string;
  onSelectSuggestion: (prompt: string) => void;
  onRegenerate: () => void;
  onRetry: () => void;
  editingMessageId: string | null;
  editInput: string;
  onEditChange: (val: string) => void;
  onStartEdit: (id: string, content: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onScrollStateChange?: (showScrollBottom: boolean) => void;
  registerScrollToBottom?: (fn: () => void) => void;
}

export function ChatMessages({
  messages,
  isGenerating,
  generationStage,
  activeModelId,
  onSelectSuggestion,
  onRegenerate,
  onRetry,
  editingMessageId,
  editInput,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onScrollStateChange,
  registerScrollToBottom,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView?.({ behavior });
  };

  useEffect(() => {
    registerScrollToBottom?.(() => scrollToBottom("smooth"));
  }, [registerScrollToBottom]);

  // Monitor scroll position
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    const threshold = 120;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isNearBottomRef.current = isNearBottom;
    const shouldShow = !isNearBottom;
    setShowScrollBottom(shouldShow);
    onScrollStateChange?.(shouldShow);
  };

  // Auto-scroll when messages update: instant scrollTop during generation (prevents smooth-scroll lag), smooth otherwise
  useEffect(() => {
    if (isNearBottomRef.current) {
      if (isGenerating && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else {
        bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
      }
    }
  }, [messages, isGenerating]);

  if (messages.length === 0) {
    return (
      <div
        data-testid="chat-messages"
        className="relative flex flex-1 flex-col items-center justify-start overflow-y-auto p-4 sm:justify-center"
      >
        <EmptyState onSelectSuggestion={onSelectSuggestion} />
      </div>
    );
  }

  // Determine last user and assistant message indices
  let lastUserIdx = -1;
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (lastUserIdx === -1 && messages[i].role === "USER") {
      lastUserIdx = i;
    }
    if (lastAssistantIdx === -1 && messages[i].role === "ASSISTANT") {
      lastAssistantIdx = i;
    }
    if (lastUserIdx !== -1 && lastAssistantIdx !== -1) break;
  }

  return (
    <div
      data-testid="chat-messages"
      className="relative z-0 flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4"
      >
        <div className="max-w-4xl mx-auto space-y-2 pb-6">
          {messages.map((msg, idx) => (
            <MessageItem
              key={msg.id || idx}
              message={msg}
              isLastUser={idx === lastUserIdx}
              isLastAssistant={idx === lastAssistantIdx}
              isGenerating={isGenerating && idx === lastAssistantIdx}
              generationStage={generationStage}
              activeModelId={activeModelId}
              isEditing={editingMessageId === msg.id}
              editValue={editInput}
              onEditChange={onEditChange}
              onStartEdit={() => onStartEdit(msg.id, msg.content)}
              onCancelEdit={onCancelEdit}
              onSaveEdit={() => onSaveEdit(msg.id)}
              onRegenerate={onRegenerate}
              onRetry={onRetry}
            />
          ))}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {!onScrollStateChange && showScrollBottom && (
        <Button
          data-testid="scroll-to-bottom-button"
          size="icon"
          variant="outline"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-3 right-6 sm:right-10 h-8 w-8 rounded-full border border-border bg-background/95 backdrop-blur shadow-md hover:bg-accent text-foreground z-20 transition-all duration-200"
          aria-label="Gulir ke bawah"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
