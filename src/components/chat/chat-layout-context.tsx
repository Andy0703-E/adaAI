"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

interface ChatHeaderLayoutValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const ChatLayoutContext = createContext<ChatHeaderLayoutValue | null>(null);

export function ChatLayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((prev) => !prev),
      mobileSidebarOpen,
      setMobileSidebarOpen,
      openMobileSidebar: () => setMobileSidebarOpen(true),
      closeMobileSidebar: () => setMobileSidebarOpen(false),
    }),
    [sidebarCollapsed, mobileSidebarOpen]
  );

  return (
    <ChatLayoutContext.Provider value={value}>
      {children}
    </ChatLayoutContext.Provider>
  );
}

export function useChatLayout() {
  const context = useContext(ChatLayoutContext);
  if (!context) {
    return {
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
      toggleSidebar: () => {},
      mobileSidebarOpen: false,
      setMobileSidebarOpen: () => {},
      openMobileSidebar: () => {},
      closeMobileSidebar: () => {},
    };
  }
  return context;
}
