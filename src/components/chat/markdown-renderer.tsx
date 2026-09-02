"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { CodeBlock } from "./code-block";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface MarkdownRendererProps {
  content: string;
}

function parseContentWithThoughts(raw: string) {
  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i;
  const match = thinkRegex.exec(raw);

  if (!match) {
    return { thoughts: null, mainContent: raw, isThinking: false };
  }

  const thoughts = match[1].trim();
  const isThinking = !raw.includes("</think>");
  const mainContent = raw.replace(thinkRegex, "").trim();

  return { thoughts, mainContent, isThinking };
}

// Ensure code blocks and safe markdown attributes are permitted by sanitize schema
const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { thoughts, mainContent, isThinking } = parseContentWithThoughts(content);
  const [thoughtsOpen, setThoughtsOpen] = React.useState(isThinking);

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] sm:text-base leading-[1.65] break-words space-y-3 font-normal">
      {thoughts && (
        <div className="skeu-inset my-2 overflow-hidden rounded-xl text-xs not-prose">
          <button
            type="button"
            onClick={() => setThoughtsOpen((prev) => !prev)}
            className="flex items-center justify-between w-full px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-medium select-none"
          >
            <div className="flex items-center gap-2">
              <span className={cn("text-base", isThinking && "animate-pulse")}>🧠</span>
              <span className="font-sans text-xs">
                {isThinking ? "Sedang berpikir..." : "Proses Berpikir"}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                thoughtsOpen && "rotate-180"
              )}
            />
          </button>
          {thoughtsOpen && (
            <div className="border-t border-border/40 bg-background/30 px-3.5 py-2.5 font-sans text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {thoughts}
            </div>
          )}
        </div>
      )}

      {mainContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, customSanitizeSchema]]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !String(children).includes("\n");

            if (isInline) {
              return (
                <code
                  className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[13px] font-medium text-foreground/90"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match ? match[1] : undefined}
                value={String(children).replace(/\n$/, "")}
              />
            );
          },
          table({ children }) {
            return (
              <div className="skeu-inset my-4 w-full overflow-y-auto rounded-xl">
                <table className="w-full text-left text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-border bg-muted/50 px-4 py-2 font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border-b border-border px-4 py-2">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/40 pl-4 py-1 italic text-muted-foreground my-3">
                {children}
              </blockquote>
            );
          },
          ul({ children }) {
            return <ul className="list-disc list-outside pl-5 space-y-1 my-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside pl-5 space-y-1 my-2">{children}</ol>;
          },
          p({ children }) {
            return <p className="mb-2 leading-[1.65] last:mb-0">{children}</p>;
          },
        }}
      >
        {mainContent || (!thoughts ? content : "")}
      </ReactMarkdown>
      )}
    </div>
  );
}
