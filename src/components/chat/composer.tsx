"use client";

import React, { useRef, useEffect, useState } from "react";
import { ArrowUp, Square, ArrowDown, Paperclip, X, FileText, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { ModelSelector } from "../model/model-selector";
import { cn } from "@/lib/utils/cn";

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachmentIds?: string[]) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  showScrollBottom?: boolean;
  onScrollToBottom?: () => void;
  modelId?: string;
  onSelectModel?: (modelId: string) => void;
  conversationId?: string | null;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating,
  disabled = false,
  showScrollBottom = false,
  onScrollToBottom,
  modelId = "auto",
  onSelectModel = () => {},
  conversationId,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState<string | null>(null);

  // Reset attachments when conversation changes
  useEffect(() => {
    setAttachments([]);
    setTruncationWarning(null);
  }, [conversationId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (attachments.length + files.length > 3) {
      alert("Maksimal 3 lampiran per pesan.");
      return;
    }

    if (!conversationId) {
       alert("Harap ketik pesan pertama Anda sebelum mengunggah dokumen.");
       return;
    }

    setIsUploading(true);

    for (const file of files) {
      if (file.size > 5242880) {
        alert(`${file.name} melebihi batas 5MB.`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(`/api/v1/conversations/${conversationId}/attachments`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Gagal mengunggah dokumen");
        }

        setAttachments((prev) => [...prev, {
            id: data.id,
            name: data.name,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes
        }]);

      } catch (error: any) {
        alert(error.message);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset input
    }
  };

  const removeAttachment = (idToRemove: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== idToRemove));
  };

  // Autosize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to let scrollHeight shrink if text was deleted
    textarea.style.height = "0px";

    const minHeight = 24;
    const maxHeight = 180;
    // Base padding + line height essentially. We want it compact when empty.
    const scrollHeight = textarea.scrollHeight;
    
    // If it's mostly empty (just one line, no newlines), keep it at minHeight
    const nextHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, attachments.length, isUploading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && value.trim() && !disabled && !isUploading) {
        onSend(attachments.length > 0 ? attachments.map(a => a.id) : undefined);
        setAttachments([]);
      }
    }
  };

  const handleSendClick = () => {
    if (!isGenerating && value.trim() && !disabled && !isUploading) {
        onSend(attachments.length > 0 ? attachments.map(a => a.id) : undefined);
        setAttachments([]);
    }
  };

  return (
    <div data-testid="chat-composer" className="relative z-20 w-full max-w-4xl mx-auto px-3 sm:px-4 pb-3 sm:pb-4 shrink-0">
      {/* Floating scroll-to-bottom button: centered directly above composer at z-30 */}
      {showScrollBottom && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30">
          <Button
            data-testid="scroll-to-bottom-button"
            type="button"
            size="icon"
            variant="outline"
            onClick={onScrollToBottom}
            className="skeu-raised h-10 w-10 rounded-full border border-border/80 text-foreground transition-all duration-200 active:scale-95 flex items-center justify-center cursor-pointer"
            aria-label="Gulir ke bawah"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="skeu-composer relative flex flex-col transition-all duration-200 min-h-[56px] justify-end">
        
        {/* Attachments UI */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-border/10">
            {attachments.map((file) => (
              <div 
                key={file.id}
                className="flex items-center gap-2 bg-secondary/50 rounded-md py-1.5 px-3 text-xs border border-border/50"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(file.id)}
                  className="hover:bg-background rounded-full p-0.5 ml-1 transition-colors"
                  disabled={isGenerating || isUploading}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {isUploading && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-muted-foreground">
             <Loader2 className="h-3.5 w-3.5 animate-spin" />
             <span>Reading document...</span>
          </div>
        )}
        
        {truncationWarning && (
            <div className="px-4 py-1.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-xs flex justify-between items-center border-b border-yellow-500/20">
                <span>{truncationWarning}</span>
                <button onClick={() => setTruncationWarning(null)}><X className="h-3 w-3" /></button>
            </div>
        )}

        <div className="flex items-end w-full px-2 pb-2 pt-1 gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan apa saja kepada AdaAI... (Shift+Enter untuk baris baru)"
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-transparent pl-3 py-2.5 text-sm sm:text-base leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            style={{ overflowY: "hidden" }}
          />

          <div className="flex items-center gap-1.5 shrink-0 pb-0.5 pr-1">
            <div className="max-w-[100px] sm:max-w-[140px] truncate">
              <ModelSelector
                selectedModelId={modelId}
                onSelectModel={onSelectModel}
                disabled={disabled || isGenerating}
              />
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,.txt,.md"
              multiple
              onChange={handleFileSelect}
              disabled={disabled || isGenerating || isUploading || attachments.length >= 3}
            />
            
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0 hover:bg-secondary/80 text-muted-foreground transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isGenerating || isUploading || attachments.length >= 3 || !conversationId}
              title={!conversationId ? "Ketik pesan pertama untuk mengunggah" : "Attach document"}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {isGenerating ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={onStop}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shadow-[0_0_18px_hsl(0_80%_62%_/_0.2)] shrink-0"
                aria-label="Hentikan jawaban"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                disabled={!value.trim() || disabled || isUploading}
                onClick={handleSendClick}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full transition-transform active:scale-95 disabled:opacity-30 shrink-0"
                aria-label="Kirim pesan"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        AdaAI dapat membuat kesalahan. Harap verifikasi informasi penting.
      </p>
    </div>
  );
}
