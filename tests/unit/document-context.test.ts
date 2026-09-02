import { test, expect, describe } from "vitest";
import { constructDocumentContext } from "@/lib/documents/context";

describe("Document Context Utility", () => {
    test("handles empty documents", () => {
        expect(constructDocumentContext([])).toBe("");
    });

    test("constructs valid context", () => {
        const documents = [{ name: "test.txt", content: "hello world" }];
        const context = constructDocumentContext(documents);
        expect(context).toContain("<document_context>");
        expect(context).toContain("hello world");
        expect(context).toContain("test.txt");
    });
    
    test("truncates long document", () => {
        const longContent = "a".repeat(100);
        const documents = [{ name: "long.txt", content: longContent }];
        const context = constructDocumentContext(documents, 50);
        
        expect(context).toContain("[Document truncated because it exceeded AdaAI document context limit]");
        expect(context).toContain("a".repeat(50));
        expect(context).not.toContain("a".repeat(51));
    });
    
    test("handles multiple documents", () => {
       const docs = [
           { name: "a.txt", content: "alpha" },
           { name: "b.txt", content: "beta" }
       ];
       const context = constructDocumentContext(docs);
       expect(context).toContain("alpha");
       expect(context).toContain("beta");
       expect(context).toContain("a.txt");
       expect(context).toContain("b.txt");
    });
});
