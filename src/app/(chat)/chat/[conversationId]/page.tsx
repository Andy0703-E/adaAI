import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";
import { Message } from "@/types/chat";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const t0 = performance.now();
  const { conversationId } = await params;

  const session = await auth();
  const authMs = performance.now() - t0;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Run both queries in parallel — eliminates serial round-trip overhead (~400ms saved)
  const tQuery = performance.now();
  const [conversation, rawMessages] = await Promise.all([
    prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        modelId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.message.findMany({
      where: {
        conversationId,
        conversation: { userId: session.user.id },
      },
      select: {
        id: true,
        conversationId: true,
        sequenceNo: true,
        role: true,
        content: true,
        status: true,
        errorCode: true,
        modelId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const parallelQueryMs = performance.now() - tQuery;

  if (!conversation) {
    notFound();
  }

  const mappedMessages: Message[] = rawMessages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    sequenceNo: m.sequenceNo,
    role: m.role,
    content: m.content,
    status: m.status,
    errorCode: m.errorCode,
    modelId: m.modelId,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const totalMs = performance.now() - t0;

  console.log("[PERF CHAT PAGE]", {
    conversationId,
    authMs: Math.round(authMs),
    parallelQueryMs: Math.round(parallelQueryMs),
    totalMs: Math.round(totalMs),
    messageCount: mappedMessages.length,
  });

  const json = JSON.stringify(mappedMessages);
  const payloadBytes = Buffer.byteLength(json, "utf8");

  console.log("[PERF CHAT PAYLOAD]", {
    conversationId,
    bytes: payloadBytes,
    kb: Math.round(payloadBytes / 1024),
    messageCount: mappedMessages.length,
  });

  return (
    <ChatContainer
      conversationId={conversation.id}
      initialMessages={mappedMessages}
      initialModelId={conversation.modelId}
    />
  );
}
