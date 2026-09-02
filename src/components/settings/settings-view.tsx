"use client";

import React, { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useModels } from "@/hooks/use-models";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Cpu,
  Sliders,
  Trash2,
  Save,
  LogOut,
  ArrowLeft,
  Check,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";

export function SettingsView() {
  const { settings, isLoading, updateSettings } = useSettings();
  const { models } = useModels();

  const [defaultModelId, setDefaultModelId] = useState("auto");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState<number | "">("");
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    console.log("[PERF SETTINGS CLIENT MOUNT]", performance.now());
  }, []);

  useEffect(() => {
    if (settings) {
      setDefaultModelId(settings.defaultModelId || "auto");
      setSystemPrompt(settings.systemPrompt || "");
      setTemperature(settings.temperature !== null && settings.temperature !== undefined ? settings.temperature : "");
      setMaxOutputTokens(settings.maxOutputTokens !== null && settings.maxOutputTokens !== undefined ? settings.maxOutputTokens : "");
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateSettings({
        defaultModelId: defaultModelId || null,
        systemPrompt: systemPrompt.trim() || null,
        temperature: typeof temperature === "number" ? temperature : null,
        maxOutputTokens: typeof maxOutputTokens === "number" ? maxOutputTokens : null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAllConversations = async () => {
    try {
      setIsClearing(true);
      // Fetch all conversations and delete them
      const res = await fetch("/api/v1/conversations");
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          for (const c of json.data) {
            await fetch(`/api/v1/conversations/${c.id}`, { method: "DELETE" });
          }
        }
      }
      setShowClearAllDialog(false);
      window.location.href = "/";
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="settings-shell min-h-screen text-foreground py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="skeu-surface flex items-center justify-between mb-7 p-3 sm:p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Kembali ke chat">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span>Keluar</span>
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Model Preferences */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Cpu className="h-5 w-5 text-primary" />
            <h2>Preferensi Model</h2>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Model Default untuk Percakapan Baru
            </label>
            <select
              value={defaultModelId}
              onChange={(e) => setDefaultModelId(e.target.value)}
              disabled={isLoading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <option>Memuat model...</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-popover text-popover-foreground">
                    {m.name} ({m.id})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              System Prompt Default
            </label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={isLoading}
              placeholder={isLoading ? "Memuat pengaturan..." : "Contoh: Anda adalah asisten AI yang ramah dan selalu memberikan jawaban berbasis kode terstruktur..."}
              rows={4}
              maxLength={8000}
            />
            <p className="text-[11px] text-muted-foreground">
              Instruksi dasar yang diterapkan pada setiap percakapan baru.
            </p>
          </div>
        </section>

        {/* Model Generation Parameters */}
        <section className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Sliders className="h-5 w-5 text-primary" />
            <h2>Parameter Inferensi</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Temperature (0.0 - 2.0)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                disabled={isLoading}
                value={temperature}
                onChange={(e) =>
                  setTemperature(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                placeholder={isLoading ? "Memuat..." : "Default model (misal 0.7)"}
              />
              <p className="text-[11px] text-muted-foreground italic">
                * Bergantung pada dukungan model/provider.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Max Output Tokens
              </label>
              <Input
                type="number"
                min="1"
                max="32768"
                disabled={isLoading}
                value={maxOutputTokens}
                onChange={(e) =>
                  setMaxOutputTokens(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
                placeholder={isLoading ? "Memuat..." : "Default model (misal 8192)"}
              />
              <p className="text-[11px] text-muted-foreground italic">
                * Bergantung pada limit maksimum model.
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
            {saveSuccess && (
              <span className="flex items-center text-xs font-medium text-green-600 dark:text-green-400 gap-1">
                <Check className="h-4 w-4" />
                <span>Pengaturan berhasil disimpan!</span>
              </span>
            )}
            <Button type="submit" disabled={isSaving || isLoading} className="gap-2 self-stretch sm:ml-auto sm:self-auto">
              {isSaving ? "Menyimpan..." : <Save className="h-4 w-4" />}
              <span>Simpan Perubahan</span>
            </Button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-3 pt-6 border-t border-destructive/20 mt-8">
          <h2 className="text-sm font-bold text-destructive uppercase tracking-wider">
            Zona Berbahaya
          </h2>
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Hapus Seluruh Percakapan
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Menghapus semua riwayat percakapan dan pesan Anda secara permanen.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowClearAllDialog(true)}
              className="shrink-0 gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>Hapus Semua Chat</span>
            </Button>
          </div>
        </section>
      </form>

      {/* Clear All Confirmation Modal */}
      <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Hapus Seluruh Percakapan?</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus seluruh percakapan dan pesan yang ada di akun Anda secara permanen. Data tidak dapat dipulihkan kembali.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearAllDialog(false)}
              disabled={isClearing}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllConversations}
              disabled={isClearing}
            >
              {isClearing ? "Menghapus..." : "Hapus Semua Percakapan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
