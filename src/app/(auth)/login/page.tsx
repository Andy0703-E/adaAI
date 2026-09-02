"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email atau password yang Anda masukkan salah.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba beberapa saat lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-[0.9fr_1fr]">
        <aside className="hidden lg:flex flex-col items-center text-center px-8">
          <div className="auth-orbit mb-9">
            <div className="brand-mark relative h-48 w-48 rounded-[3.2rem]">
              <img src="/adaai-robot.jpg" alt="Robot AdaAI" />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">AdaAI workspace</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Asisten yang terasa dekat.</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Ruang berpikir pribadi yang lembut, fokus, dan selalu siap membantu.
          </p>
        </aside>

        <div className="auth-card w-full space-y-6 p-6 sm:p-8">
          <div className="text-center space-y-2">
          <Link href="/" className="brand-mark inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-2">
            <img src="/adaai-robot.jpg" alt="AdaAI" />
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Selamat datang kembali</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Masuk ke AdaAI
          </h1>
          <p className="text-sm text-muted-foreground">
            Lanjutkan percakapan Anda dan simpan riwayat di semua perangkat.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="h-10 text-sm"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Password</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-11 text-sm font-bold">
            {isLoading ? "Memproses..." : "Masuk"}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          Belum memiliki akun?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Daftar sekarang
          </Link>
        </div>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <span>Lanjutkan sebagai tamu</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
