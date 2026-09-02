"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sesuai.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message || "Pendaftaran gagal. Silakan coba lagi.");
        return;
      }

      // Auto sign-in after successful registration
      const signInRes = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.");
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
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Mulai dengan satu ide.</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Simpan percakapan penting dan jadikan setiap sesi lebih produktif.
          </p>
        </aside>

        <div className="auth-card w-full space-y-6 p-6 sm:p-8">
          <div className="text-center space-y-2">
          <Link href="/" className="brand-mark inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-2">
            <img src="/adaai-robot.jpg" alt="AdaAI" />
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Ruang kerja pribadi</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Daftar Akun AdaAI
          </h1>
          <p className="text-sm text-muted-foreground">
            Mulai simpan riwayat percakapan Anda secara aman di cloud.
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
            <label className="text-xs font-medium text-foreground">Nama Lengkap</label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="h-10 text-sm"
              minLength={2}
              maxLength={120}
            />
          </div>

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
            <label className="text-xs font-medium text-foreground">Password (min. 8 karakter)</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm"
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Konfirmasi Password</label>
            <Input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm"
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-11 text-sm font-bold">
            {isLoading ? "Mendaftarkan..." : "Daftar"}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Masuk di sini
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
