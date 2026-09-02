import React from "react";

export default function Loading() {
  return (
    <div className="flex h-ull flex-col bg-background">
      <div className="h-14 border-b border-border/70 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-muted animate-pulse" />
      </div>

      <div className="mx-auto w-full max-w-3l flex-1 p-6 space-y-6 overflow-hidden">
        <div className="space-y-2 animate-pulse">
          <div className="h-4 w-24 rounded bg-muted/60" />
          <div className="h-10 w-3/4 rounded-xl bg-muted" />
        </div>

        <div className="space-y-2 animate-pulse">
          <div className="h-4 w-20 rounded bg-muted/60" />
          <div className="h-20 w-full rounded-xl bg-muted" />
          <div className="h-12 w-4/5 rounded-xl bg-muted" />
        </div>
      </div>

      <div className="w-full max-w-4l mx-auto px-4 pb-4">
        <div className="h-14 rounded-2xl border border-border bg-muted/30 animate-pulse" />
      </div>
    </div>
  );
}
