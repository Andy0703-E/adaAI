"use client";

import React, { useState } from "react";
import { Message } from "@/types/chat";
import { GenerationStage } from "@/hooks/use-chat";
import { MarkdownRenderer } from "./markdown-renderer";
import { Button } from "../ui/button";
import { Copy, Check, RotateCcw, Edit2, AlertCircle, CheckCheck } from "lucide-react";
import { Badge } from "../ui/badge";

interface MessageItemProps {
  message: Message;
  isLastUser: boolean;
  isLastAssistant: boolean;
  isGenerating: boolean;
  generationStage?: GenerationStage;
  activeModelId?: string;
  isEditing: boolean;
  editValue: string;
  onEditChange: (val: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
}

export function MessageItem({
  message,
  isLastUser,
  isLastAssistant,
  isGenerating,
  generationStage,
  activeModelId,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRegenerate,
  onRetry,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "USER";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-4 group">
        <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end">
          {isEditing ? (
            <div className="skeu-surface flex w-full flex-col gap-2 rounded-2xl p-3">
              <textarea
                value={editValue}
                onChange={(e) => onEditChange(e.target.value)}
                rows={3}
                className="skeu-input w-full resize-none p-2 text-sm focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground italic">
                * Respons setelah pesan ini akan digantikan dengan jawaban baru.
              </p>
              <div className="flex justify-end gap-2 mt-1">
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  Batal
                </Button>
                <Button size="sm" onClick={onSaveEdit} disabled={!editValue.trim() || isGenerating}>
                  Simpan & Hasilkan Ulang
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative group/bubble">
              <div className="skeu-user-message text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] font-normal leading-[1.6] whitespace-pre-wrap">
                {message.content}
              </div>

              {/* User message actions */}
              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[12px] font-medium">
                {isLastUser && !isGenerating && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStartEdit}
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Edit pesan"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    <span>Edit</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Salin teks prompt"
                >
                  {copied ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                  <span>{copied ? "Tersalin" : "Salin"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full my-6 group">
      <div className="absolute right-full mr-3 top-0 hidden sm:flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl brand-mark">
        <img src="/adaai-robot.jpg" alt="AdaAI" />
      </div>

      <div className="w-full space-y-2 overflow-hidden">
        <div className="skeu-assistant-card relative px-4 py-3 text-[15px] font-normal leading-[1.65] overflow-hidden min-w-0">
          {message.status === "PENDING" && !message.content ? (
          <div className="flex items-center gap-2 py-1 text-[14px] font-normal text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />
            <span>
              {generationStage === "connecting"
                ? "Menghubungkan..."
                : generationStage === "waiting_model"
                ? `Menunggu ${activeModelId || "model"}...`
                : generationStage === "thinking"
                ? "Sedang berpikir..."
                : "Menjawab..."}
            </span>
          </div>
          ) : message.status === "STREAMING" ? (
          <div className="whitespace-pre-wrap text-[15px] leading-[1.65] break-words font-normal text-foreground/90">
            {message.content}
            <span className="inline-block h-4 w-1.5 bg-primary/70 animate-pulse ml-0.5 align-middle" />
          </div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}

          {message.status === "CANCELLED" && (
            <div className="pt-2">
              <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                Dihentikan
              </Badge>
            </div>
          )}

          {message.status === "FAILED" && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm mt-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">Gagal memproses jawaban. Silakan coba lagi.</span>
              <Button size="sm" variant="outline" onClick={onRetry} className="h-7 text-xs border-destructive/40 hover:bg-destructive/20">
                <RotateCcw className="h-3 w-3 mr-1" />
                Coba Lagi
              </Button>
            </div>
          )}
        </div>

        {/* Action bar for assistant */}
        {message.content && !isGenerating && (
          <div className="flex items-center gap-1.5 pt-2 opacity-80 group-hover:opacity-100 transition-opacity text-[12px] font-medium">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Salin jawaban"
            >
              {copied ? (
                <>
                  <CheckCheck className="h-3.5 w-3.5 mr-1 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  <span>Salin</span>
                </>
              )}
            </Button>

            {isLastAssistant && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Hasilkan ulang jawaban"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                <span>Hasilkan Ulang</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
