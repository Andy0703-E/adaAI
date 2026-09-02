import { test, expect, describe } from "vitest";
import { constructDocumentContext, DOCUMENT_MAX_CONTEXT_CHARS } from "@/lib/documents/context";

describe("Document Context Utility", () => {
    test("handles empty documents", () => {
        expect(constructDocumentContext([]).content).toBe("");
    });

    test("constructs valid context securely bounding untrusted content", () => {
        const documents = [{ name: "test.txt", content: "hello world" }];
        const context = constructDocumentContext(documents);
        expect(context.content).toContain("ADA-AI-DOCUMENT-BOUNDARY");
        expect(context.content).toContain("hello world");
        expect(context.content).toContain("test.txt");
        expect(context.truncated).toBe(false);
    });
    
    test("truncates long document according to max bytes", () => {
        const longContent = "a".repeat(300000);
        const documents = [{ name: "long.txt", content: longContent }];
        const context = constructDocumentContext(documents, 120000);
        
        expect(context.content).toContain("[Document truncated because it exceeded AdaAI document context limit]");
        expect(context.content).toContain("a".repeat(120000));
        expect(context.content).not.toContain("a".repeat(120001));
        expect(context.truncated).toBe(true);
        expect(context.includedChars).toBe(120000);
        expect(context.totalChars).toBe(300000);
    });
});
