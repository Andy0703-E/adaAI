import { ChatContainer } from "@/components/chat/chat-container";

export const metadata = {
  title: "AdaAI - Platform Chat AI Modern",
  description: "Aplikasi AI Chat production-ready dengan streaming real-time dan multi-model.",
};

export default function HomePage() {
  return <ChatContainer initialModelId="deepseek-v4-flash" />;
}
