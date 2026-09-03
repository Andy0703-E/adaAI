"use client";

import React from "react";
import Image from "next/image";
import { Code, BookOpen, Lightbulb, FileText, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  onSelectSuggestion: (text: string) => void;
}

const suggestionPool = [
  {
    icon: Code,
    title: "Buatkan landing page",
    prompt: "Buatkan landing page modern untuk produk SaaS saya menggunakan Next.js dan Tailwind CSS.",
  },
  {
    icon: BookOpen,
    title: "Jelaskan kode",
    prompt: "Jelaskan bagaimana cara kerja asynchronous generator dan streaming di JavaScript secara sederhana.",
  },
  {
    icon: Lightbulb,
    title: "Ide project aplikasi",
    prompt: "Berikan 5 ide project full-stack yang menarik untuk portofolio programmer dengan fitur AI.",
  },
  {
    icon: FileText,
    title: "Ringkas teks penting",
    prompt: "Bantu saya merangkum teks berikut menjadi 5 poin tindakan paling krusial.",
  },
  {
    icon: Code,
    title: "Perbaiki error kode",
    prompt: "Bantu saya menemukan penyebab error pada kode berikut dan berikan perbaikannya.",
  },
  {
    icon: BookOpen,
    title: "Belajar konsep baru",
    prompt: "Jelaskan konsep teknologi yang saya pilih dengan analogi sederhana dan contoh praktis.",
  },
  {
    icon: Lightbulb,
    title: "Rancang fitur produk",
    prompt: "Bantu saya merancang fitur produk digital, termasuk alur pengguna dan prioritas pengerjaannya.",
  },
  {
    icon: FileText,
    title: "Tulis email profesional",
    prompt: "Buatkan email profesional yang singkat, jelas, dan sesuai konteks berikut.",
  },
  {
    icon: Code,
    title: "Review pull request",
    prompt: "Tinjau perubahan kode berikut, temukan potensi bug, dan berikan saran peningkatan.",
  },
  {
    icon: BookOpen,
    title: "Buat rencana belajar",
    prompt: "Susun rencana belajar 30 hari untuk topik yang saya pilih, lengkap dengan latihan hariannya.",
  },
  {
    icon: Lightbulb,
    title: "Susun strategi konten",
    prompt: "Bantu saya membuat strategi konten satu minggu yang relevan untuk audiens saya.",
  },
  {
    icon: FileText,
    title: "Analisis kebutuhan sistem",
    prompt: "Bantu saya mengubah ide aplikasi menjadi daftar kebutuhan fitur, data, dan prioritas MVP.",
  },
];

function getLocalDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function getDailySuggestions(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const startIndex = ((dayNumber % suggestionPool.length) + suggestionPool.length) % suggestionPool.length;

  return Array.from(
    { length: 4 },
    (_, index) => suggestionPool[(startIndex + index * 3) % suggestionPool.length]
  );
}

export function EmptyState({ onSelectSuggestion }: EmptyStateProps) {
  const [dayKey, setDayKey] = React.useState<string | null>(null);
  const suggestions = React.useMemo(
    () => (dayKey ? getDailySuggestions(dayKey) : suggestionPool.slice(0, 4)),
    [dayKey]
  );

  React.useEffect(() => {
    let timeoutId: number;

    const scheduleNextUpdate = () => {
      setDayKey(getLocalDayKey());
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 5, 0);
      timeoutId = window.setTimeout(scheduleNextUpdate, nextDay.getTime() - now.getTime());
    };

    scheduleNextUpdate();
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center mx-auto w-full max-w-[900px] px-3 sm:px-4 md:px-5 py-6 text-center animate-in fade-in-50 duration-300 sm:py-8">
      <div data-testid="empty-state-logo" className="auth-orbit relative z-20 mb-5 sm:mb-6">
        <div className="brand-mark relative flex h-20 w-20 items-center justify-center rounded-[1.65rem]">
          <Image
            src="/adaai-robot.webp"
            alt="Robot AdaAI"
            width={512}
            height={512}
            priority
            sizes="80px"
            className="h-20 w-20 object-contain"
          />
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-foreground">
        Ada yang bisa saya bantu hari ini?
      </h1>
      <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-md">
        Mulai percakapan dengan memilih salah satu ide di bawah atau ketik langsung pertanyaan Anda.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectSuggestion(item.prompt)}
              className="skeu-surface group flex flex-col justify-between p-4 rounded-2xl hover:border-primary/45 transition-all duration-200 text-left hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {item.prompt}
              </p>
              <div className="flex items-center text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Gunakan prompt</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
