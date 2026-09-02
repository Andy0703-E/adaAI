"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Search, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { SearchResultItem } from "@/types/api";
import { useRouter } from "next/navigation";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search (300ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(() => {
      fetch(`/api/v1/conversations/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            setResults(json.data);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  const handleSelect = (id: string) => {
    onOpenChange(false);
    router.push(`/chat/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 p-4 pb-3">
          <DialogTitle className="text-base font-semibold">Cari Percakapan</DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari berdasarkan judul atau isi percakapan..."
              className="h-9 border-none bg-transparent px-1 shadow-none focus-visible:ring-0 text-sm"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Mencari...
            </div>
          ) : query && results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Tidak ada hasil yang cocok dengan &quot;{query}&quot;.
            </div>
          ) : !query ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Ketik kata kunci untuk mencari seluruh judul dan riwayat pesan.
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="skeu-raised group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-transform hover:-translate-y-px"
              >
                <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 overflow-hidden space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate max-w-[340px]">
                      {item.title}
                    </span>
                    {item.lastMessageAt && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.lastMessageAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {item.snippet && (
                    <p className="skeu-inset line-clamp-2 rounded-lg p-1.5 text-xs italic text-muted-foreground">
                      &ldquo;{item.snippet}&rdquo;
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
