"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-yaml";
import { Button } from "../ui/button";

// Prism normally scans and rewrites every <pre> after page load. That mutation
// happens before React hydration in a streamed chat response, so rendering is
// kept manual below to ensure the server and browser markup stay identical.
Prism.manual = true;

interface CodeBlockProps {
  language?: string;
  value: string;
}

const languageAliases: Record<string, string> = {
  html: "markup",
  xml: "markup",
  svg: "markup",
  js: "javascript",
  ts: "typescript",
  shell: "bash",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

function normalizeLanguage(language?: string) {
  const normalized = language?.toLowerCase().trim() || "text";
  return languageAliases[normalized] || normalized;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const normalizedLanguage = normalizeLanguage(language);
  const grammar = Prism.languages[normalizedLanguage];
  const highlightedCode = grammar
    ? Prism.highlight(value, grammar, normalizedLanguage)
    : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="skeu-inset relative my-4 overflow-hidden rounded-2xl font-mono text-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">{normalizedLanguage}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs flex items-center gap-1.5"
          aria-label="Salin kode"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Salin</span>
            </>
          )}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto font-mono leading-relaxed text-foreground/90">
        {highlightedCode ? (
          <code
            className={`code-syntax language-${normalizedLanguage}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        ) : (
          <code className="code-syntax">{value}</code>
        )}
      </pre>
    </div>
  );
}
