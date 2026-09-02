"use client";

import React, { useState, useMemo } from "react";
import { useModels } from "@/hooks/use-models";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChevronDown, Search, Check, Cpu, Eye } from "lucide-react";
import { Badge } from "../ui/badge";

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModelId,
  onSelectModel,
  disabled = false,
}: ModelSelectorProps) {
  const { models, isLoading } = useModels();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const lower = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower)
    );
  }, [models, search]);

  const currentModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || {
      id: selectedModelId,
      name: selectedModelId,
      isAvailable: true,
    };
  }, [models, selectedModelId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="skeu-inset flex h-9 w-auto min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-border/70 px-2.5 font-semibold text-xs hover:bg-accent/60 sm:text-sm"
          aria-label="Pilih Model AI"
          title={currentModel.name}
        >
          <Cpu className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 truncate whitespace-nowrap">
            {currentModel.name}
          </span>
          <ChevronDown className="ml-0.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2 pb-2 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari model AI..."
              className="h-7 text-xs border-none shadow-none focus-visible:ring-0 px-1"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Memuat daftar model...
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Model tidak ditemukan.
              </div>
            ) : (
              filteredModels.map((model) => {
                const isSelected = model.id === selectedModelId;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-start justify-between p-2 rounded-md text-left transition-colors text-xs ${
                      isSelected
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{model.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[210px]">
                        {model.id}
                      </p>
                      <div className="flex items-center gap-1 pt-0.5">
                        {model.capabilities?.vision && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                            <Eye className="h-2.5 w-2.5" />
                            <span>Vision</span>
                          </Badge>
                        )}
                        {model.contextWindow && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {Math.round(model.contextWindow / 1000)}k ctx
                          </Badge>
                        )}
                      </div>
                    </div>

                    {!model.isAvailable && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">
                        Tidak Tersedia
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
