"use client";

import React, { useRef, useEffect } from "react";
import { ArrowUp, Square, ArrowDown } from "lucide-react";
import { Button } from "../ui/button";
import { ModelSelector } from "../model/model-selector";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  showScrollBottom?: boolean;
  onScrollToBottom?: () => void;
  modelId?: string;
  onSelectModel?: (modelId: string) => void;
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
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autosize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 52), 220);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && value.trim() && !disabled) {
        onSend();
      }
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

      <div className="skeu-composer relative flex flex-col transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanyakan apa saja kepada AdaAI... (Shift+Enter untuk baris baru)"
          rows={1}
          disabled={disabled}
          className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-sm sm:text-base leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />

        <div className="absolute right-3 bottom-2.5 flex items-center gap-2">
          <ModelSelector
            selectedModelId={modelId}
            onSelectModel={onSelectModel}
            disabled={disabled || isGenerating}
          />
          {isGenerating ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={onStop}
              className="h-10 w-10 rounded-full shadow-[0_0_18px_hsl(0_80%_62%_/_0.2)]"
              aria-label="Hentikan jawaban"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              disabled={!value.trim() || disabled}
              onClick={onSend}
              className="h-10 w-10 rounded-full transition-transform active:scale-95 disabled:opacity-30"
              aria-label="Kirim pesan"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        AdaAI dapat membuat kesalahan. Harap verifikasi informasi penting.
      </p>
    </div>
  );
}
