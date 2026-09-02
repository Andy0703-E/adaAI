"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Conversation, Message } from "@/types/chat";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { prependActiveConversationToCache } from "@/lib/conversations/cache";

interface UseChatOptions {
  conversationId?: string;
  initialMessages?: Message[];
  initialModelId?: string;
  onConversationCreated?: (id: string) => void;
}

const EMPTY_MESSAGES: Message[] = [];

export type GenerationStage = "idle" | "connecting" | "waiting_model" | "thinking" | "answering";

export function useChat({
  conversationId: propConversationId,
  initialMessages = EMPTY_MESSAGES,
  initialModelId = "deepseek-v4-flash",
  onConversationCreated,
}: UseChatOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuth = Boolean(session?.user?.id);

  const [conversationId, setConversationId] = useState<string | undefined>(propConversationId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [modelId, setModelId] = useState<string>(initialModelId);
  const [input, setInput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | undefined>(propConversationId);
  const createConversationPromiseRef = useRef<Promise<string | null> | null>(null);
  const loadedConvIdRef = useRef<string | null>(propConversationId ?? null);
  const accumulatedRef = useRef("");
  const serverAssistantIdRef = useRef<string | null>(null);
  const prevPropConvIdRef = useRef<string | undefined>(propConversationId);
  const initialMessagesRef = useRef(initialMessages);
  initialMessagesRef.current = initialMessages;

  // Sync conversationId & initialMessages from props ONLY when switching to a different conversation
  useEffect(() => {
    if (propConversationId !== prevPropConvIdRef.current) {
      prevPropConvIdRef.current = propConversationId;
      conversationIdRef.current = propConversationId;
      setConversationId(propConversationId);
      if (propConversationId && initialMessagesRef.current.length > 0) {
        loadedConvIdRef.current = propConversationId;
        setMessages(initialMessagesRef.current);
      }
    }
  }, [propConversationId]);

  // Load guest messages from sessionStorage if guest and no prop ID
  useEffect(() => {
    if (!isAuth && !propConversationId) {
      try {
        const stored = sessionStorage.getItem("ada_ai_guest_chat");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [isAuth, propConversationId]);

  // Persist guest messages to sessionStorage whenever messages change and not generating
  useEffect(() => {
    if (isGenerating) return;
    if (!isAuth && !conversationId && messages.length > 0) {
      try {
        sessionStorage.setItem("ada_ai_guest_chat", JSON.stringify(messages));
      } catch {
        // ignore
      }
    }
  }, [isGenerating, messages, isAuth, conversationId]);

  // Fetch authenticated messages only once when switching to a conversation that didn't have initialMessages passed
  useEffect(() => {
    if (
      isAuth &&
      conversationId &&
      loadedConvIdRef.current !== conversationId &&
      messages.length === 0
    ) {
      loadedConvIdRef.current = conversationId;
      fetch(`/api/v1/conversations/${conversationId}/messages`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            setMessages(json.data);
          }
        })
        .catch(() => {});
    }
  }, [isAuth, conversationId, messages.length]);

  // Abort active generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setGenerationStage("idle");
  }, []);

  /**
   * Creates a conversation without sending any message.
   * Used by the Composer to prepare a conversation before attachment upload.
   * Returns the new conversationId or null on failure.
   */
  const createConversation = useCallback(
    async (title?: string): Promise<string | null> => {
      if (!isAuth) return null;
      if (conversationIdRef.current) return conversationIdRef.current;
      if (createConversationPromiseRef.current) return createConversationPromiseRef.current;

      createConversationPromiseRef.current = (async () => {
        try {
          const res = await fetch("/api/v1/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title || "New Chat", modelId }),
          });
          if (!res.ok) return null;
          const json = await res.json();
          const newConversation = json.data as Conversation;
          conversationIdRef.current = newConversation.id;
          prependActiveConversationToCache(queryClient, session?.user?.id, newConversation);
          loadedConvIdRef.current = newConversation.id;
          setConversationId(newConversation.id);
          window.history.replaceState(null, "", `/chat/${newConversation.id}`);
          if (onConversationCreated) onConversationCreated(newConversation.id);
          return newConversation.id;
        } catch {
          return null;
        } finally {
          createConversationPromiseRef.current = null;
        }
      })();

      return createConversationPromiseRef.current;
    },
    [isAuth, modelId, queryClient, session?.user?.id, onConversationCreated]
  );

  // Send message
  const sendMessage = useCallback(
    async (
      promptToSend?: string,
      overrideMessages?: Message[],
      attachmentIds?: string[]
    ) => {
      const text = (promptToSend ?? input).trim();
      if (!text || isGenerating) return;

      setErrorBanner(null);
      const tempUserMessageId = crypto.randomUUID();
      const tempAssistantId = crypto.randomUUID();

      const userMsg: Message = {
        id: tempUserMessageId,
        conversationId: conversationId || "temp",
        sequenceNo: (overrideMessages ?? messages).length + 1,
        role: "USER",
        content: text,
        status: "COMPLETED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const assistantMsg: Message = {
        id: tempAssistantId,
        conversationId: conversationId || "temp",
        sequenceNo: (overrideMessages ?? messages).length + 2,
        role: "ASSISTANT",
        content: "",
        status: "PENDING",
        modelId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedList = [...(overrideMessages ?? messages), userMsg, assistantMsg];
      setMessages(updatedList);
      setInput("");
      setIsGenerating(true);
      setGenerationStage("connecting");

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const clientStartTime = Date.now();
      const requestId = crypto.randomUUID();
      console.log("[CLIENT REQUEST START]", { requestId, time: clientStartTime });

      accumulatedRef.current = "";
      serverAssistantIdRef.current = null;
      let flushTimer: NodeJS.Timeout | null = null;

      try {
        let activeConvId = conversationIdRef.current;

        // If authenticated and no conversation exists yet, create one first
        if (isAuth && !activeConvId) {
          const createdConversationId = await createConversation(
            text.slice(0, 40) + (text.length > 40 ? "..." : "")
          );
          if (!createdConversationId) {
            throw new Error("Gagal menginisialisasi percakapan baru.");
          }
          activeConvId = createdConversationId;
        }

        setGenerationStage("waiting_model");

        // Prepare request body
        const reqBody: any = isAuth
          ? {
              conversationId: activeConvId,
              content: text,
              modelId,
              attachmentIds,
            }
          : {
              messages: updatedList
                .filter((m) => m.id !== tempAssistantId)
                .map((m) => ({
                  role: m.role.toLowerCase(),
                  content: m.content,
                })),
              modelId,
            };

        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
          body: JSON.stringify(reqBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorBody = await res.text();
          console.error("[CHAT HTTP ERROR]", {
            requestId,
            status: res.status,
            statusText: res.statusText,
            body: errorBody,
          });
          throw new Error(`Chat request failed: ${res.status} ${errorBody}`);
        }

        if (!res.body) {
          throw new Error("Response body tidak tersedia.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let firstEventLogged = false;
        let firstReasoningLogged = false;
        let firstContentLogged = false;

        const flushContent = () => {
          const content = accumulatedRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId
                ? {
                    ...m,
                    content,
                    status: "STREAMING" as const,
                  }
                : m
            )
          );
          flushTimer = null;
        };

        const queueContent = (chunk: string) => {
          accumulatedRef.current += chunk;

          if (!firstContentLogged) {
            firstContentLogged = true;
            console.log("[Client AI] First CONTENT in", Date.now() - clientStartTime, "ms");
            flushContent();
            return;
          }

          if (flushTimer !== null) return;

          flushTimer = setTimeout(flushContent, 40);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";

          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;

            if (!firstEventLogged) {
              firstEventLogged = true;
              console.log("[Client AI] First SSE event in", Date.now() - clientStartTime, "ms");
            }

            const lines = rawEvent.split(/\r?\n/);
            let eventType = "chunk";
            let dataStr = "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("event:")) {
                eventType = trimmed.slice(6).trim();
              } else if (trimmed.startsWith("data:")) {
                dataStr = trimmed.slice(5).trim();
              }
            }

            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);

              if (parsed.messageId) {
                serverAssistantIdRef.current = parsed.messageId;
              }

              if (eventType === "status") {
                if (parsed.status === "reasoning") {
                  if (!firstReasoningLogged) {
                    firstReasoningLogged = true;
                    console.log("[Client AI] First REASONING in", Date.now() - clientStartTime, "ms");
                  }
                  setGenerationStage("thinking");
                } else if (parsed.status === "answering") {
                  setGenerationStage("answering");
                }
              } else if (eventType === "content" || (eventType === "chunk" && parsed.content)) {
                setGenerationStage("answering");
                queueContent(parsed.content);
              } else if (eventType === "done" || parsed.status === "COMPLETED") {
                if (flushTimer) {
                  clearTimeout(flushTimer);
                  flushTimer = null;
                }
                setGenerationStage("idle");
                const permanentId = serverAssistantIdRef.current || tempAssistantId;
                const finalContent = accumulatedRef.current;

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAssistantId
                      ? { ...m, id: permanentId, status: "COMPLETED" as const, content: finalContent }
                      : m
                  )
                );
              } else if (eventType === "error") {
                throw new Error(parsed.message || "Kesalahan streaming dari server");
              }
            } catch (sseErr) {
              // ignore parse errors for non-json or malformed
            }
          }
        }
      } catch (err: any) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        if (err.name === "AbortError" || controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId ? { ...m, status: "CANCELLED" as const } : m
            )
          );
        } else {
          setErrorBanner(err.message || "Terjadi kesalahan saat memproses jawaban.");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId
                ? { ...m, status: "FAILED" as const, errorCode: "PROVIDER_ERROR" }
                : m
            )
          );
        }
      } finally {
        setIsGenerating(false);
        setGenerationStage("idle");
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isGenerating,
      conversationId,
      isAuth,
      modelId,
      messages,
      onConversationCreated,
      createConversation,
      queryClient,
      session?.user?.id,
    ]
  );

  // Regenerate last assistant response
  const regenerateLast = useCallback(async () => {
    if (isGenerating || messages.length < 2) return;

    // Find the last user message
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "USER") {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const trimmedHistory = messages.slice(0, lastUserIndex);
    const lastUserMsg = messages[lastUserIndex];

    await sendMessage(lastUserMsg.content, trimmedHistory);
  }, [isGenerating, messages, sendMessage]);

  // Edit last user prompt
  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditInput(currentContent);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditInput("");
  };

  const handleSaveAndRegenerate = async (messageId: string) => {
    if (!editInput.trim()) return;

    const targetIdx = messages.findIndex((m) => m.id === messageId);
    if (targetIdx === -1) return;

    const trimmedHistory = messages.slice(0, targetIdx);
    setEditingMessageId(null);

    await sendMessage(editInput.trim(), trimmedHistory);
  };

  // Reset to new chat
  const clearChat = () => {
    stopGeneration();
    setMessages([]);
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    sessionStorage.removeItem("ada_ai_guest_chat");
    router.push("/");
  };

  return {
    conversationId,
    messages,
    modelId,
    setModelId,
    input,
    setInput,
    isGenerating,
    generationStage,
    errorBanner,
    setErrorBanner,
    sendMessage,
    stopGeneration,
    createConversation,
    regenerateLast,
    clearChat,
    editingMessageId,
    editInput,
    setEditInput,
    handleStartEdit,
    handleCancelEdit,
    handleSaveAndRegenerate,
  };
}
