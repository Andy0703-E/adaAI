/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "@/components/chat/code-block";

describe("CodeBlock", () => {
  it("adds Prism token classes for supported generated code", () => {
    const { container } = render(
      <CodeBlock language="typescript" value={'const answer: string = "AdaAI";'} />
    );

    expect(screen.getByText("typescript")).not.toBeNull();
    expect(container.querySelector(".token.keyword")?.textContent).toBe("const");
    expect(container.querySelector(".token.string")?.textContent).toBe('"AdaAI"');
  });

  it("keeps unsupported code as plain text", () => {
    render(<CodeBlock language="unknown" value="<not-a-tag>" />);
    expect(screen.getByText("<not-a-tag>")).not.toBeNull();
  });
});
