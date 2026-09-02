import React from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatLayoutProvider } from "@/components/chat/chat-layout-context";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatLayoutProvider>
      <div className="flex h-dvh max-h-dvh w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="relative z-0 flex flex-1 flex-col h-dvh max-h-dvh min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </ChatLayoutProvider>
  );
}
