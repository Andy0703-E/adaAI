import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { auth } from "@/lib/auth/auth";
import { Geist } from "next/font/google";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdaAI - Platform Chat AI Modern",
  description: "AI Chat production-ready dengan streaming real-time dan multi-model.",
  icons: {
    icon: [{ url: "/adaai-robot.jpg?v=1", type: "image/jpeg" }],
    apple: [{ url: "/adaai-robot.jpg?v=1", type: "image/jpeg" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${geist.className} min-h-screen bg-background antialiased text-foreground selection:bg-primary/20`}>
        <AuthProvider session={session}>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
