"use client";

import React, { useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { Composer } from "./composer";
import { Sidebar } from "../sidebar/sidebar";
import { Message } from "@/types/chat";

interface ChatContainerProps {
  conversationId?: string;
  initialMessages?: Message[];
  initialModelId?: string;
  renderSidebar?: boolean;
}

export function ChatContainer({
  conversationId: initialId,
  initialMessages,
  initialModelId = "auto",
  renderSidebar = false,
}: ChatContainerProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const {
    conversationId,
    messages,
    modelId,
    setModelId,
    input,
    setInput,
    isGenerating,
    generationStage,
    errorBanner,
    sendMessage,
    stopGeneration,
    regenerateLast,
    editingMessageId,
    editInput,
    setEditInput,
    handleStartEdit,
    handleCancelEdit,
    handleSaveAndRegenerate,
  } = useChat({
    conversationId: initialId,
    initialMessages,
    initialModelId,
  });

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollToBottomRef = React.useRef<(() => void) | null>(null);

  const handleSelectSuggestion = (promptText: string) => {
    void sendMessage(promptText);
  };

  const handleRetryLast = () => {
    regenerateLast();
  };

  const chatWorkspace = (
    <div className="relative z-0 flex flex-1 flex-col h-full min-h-0 min-w-0 overflow-hidden">
      <ChatHeader
        title={conversationId ? "" : "Chat Baru"}
        errorBanner={errorBanner}
      />

      <ChatMessages
        messages={messages}
        isGenerating={isGenerating}
        generationStage={generationStage}
        activeModelId={modelId}
        onSelectSuggestion={handleSelectSuggestion}
        onRegenerate={regenerateLast}
        onRetry={handleRetryLast}
        editingMessageId={editingMessageId}
        editInput={editInput}
        onEditChange={setEditInput}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveAndRegenerate}
        onScrollStateChange={setShowScrollBottom}
        registerScrollToBottom={(fn) => {
          scrollToBottomRef.current = fn;
        }}
      />

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => sendMessage()}
        onStop={stopGeneration}
        isGenerating={isGenerating}
        showScrollBottom={showScrollBottom}
        onScrollToBottom={() => scrollToBottomRef.current?.()}
        modelId={modelId}
        onSelectModel={setModelId}
      />
    </div>
  );

  if (!renderSidebar) {
    return chatWorkspace;
  }

  return (
    <div className="flex h-dvh max-h-dvh w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      {chatWorkspace}
    </div>
  );
}
