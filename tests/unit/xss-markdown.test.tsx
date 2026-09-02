/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

describe("Markdown Security & XSS Protection", () => {
  it("sanitizes malicious script tags in markdown content", () => {
    const maliciousPayload = [
      "# Halo Dunia",
      "",
      "<script>alert('XSS-ATTACK');</script>",
      "",
      "<img src=\"x\" onerror=\"alert('XSS')\" />",
      "",
      "Ini teks normal [Link Aman](https://example.com)",
    ].join("\n");

    const { container } = render(<MarkdownRenderer content={maliciousPayload} />);

    // Ensure no <script> element exists in the rendered DOM
    const scripts = container.querySelectorAll("script");
    expect(scripts.length).toBe(0);

    // Ensure onerror attribute is removed from images
    const images = container.querySelectorAll("img");
    images.forEach((img) => {
      expect(img.getAttribute("onerror")).toBeNull();
    });

    // Ensure safe link is preserved
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://example.com");
  });
});
