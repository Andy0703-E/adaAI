import { test, expect, describe } from "vitest";
import { constructDocumentContext } from "@/lib/documents/context";

describe("Document Context Utility", () => {
    test("handles empty documents", () => {
        expect(constructDocumentContext([])).toBe("");
    });

    test("constructs valid context securely bounding untrusted content", () => {
        const documents = [{ name: "test.txt", content: "hello world" }];
        const context = constructDocumentContext(documents);
        expect(context).toContain("ADA-AI-DOCUMENT-BOUNDARY");
        expect(context).toContain("hello world");
        expect(context).toContain("test.txt");
    });
    
    test("truncates long document according to max bytes (240k default logic)", () => {
        const longContent = "a".repeat(300000);
        const documents = [{ name: "long.txt", content: longContent }];
        const context = constructDocumentContext(documents, 240000);
        
        expect(context).toContain("[Document truncated because it exceeded AdaAI document context limit]");
        expect(context).toContain("a".repeat(240000));
        expect(context).not.toContain("a".repeat(240001));
    });
});
