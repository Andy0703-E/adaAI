import { describe, it, expect } from "vitest";
import { parseSSEStream } from "@/lib/ai/stream-parser";

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("Stream Parser", () => {
  it("parses valid SSE delta chunks", async () => {
    const rawChunks = [
      'data: {"choices":[{"delta":{"content":"Halo "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Dunia!"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const stream = createMockStream(rawChunks);
    const parsed: string[] = [];

    for await (const chunk of parseSSEStream(stream)) {
      if (chunk.content) {
        parsed.push(chunk.content);
      }
    }

    expect(parsed.join("")).toBe("Halo Dunia!");
  });

  it("handles finish_reason and usage metadata", async () => {
    const rawChunks = [
      'data: {"choices":[{"delta":{"content":"Test"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
      "data: [DONE]\n\n",
    ];

    const stream = createMockStream(rawChunks);
    const chunks: any[] = [];

    for await (const chunk of parseSSEStream(stream)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("Test");
    expect(chunks[0].finishReason).toBe("stop");
    expect(chunks[0].usage.totalTokens).toBe(15);
  });

  it("handles malformed JSON without crashing", async () => {
    const rawChunks = [
      "data: {not-valid-json}\n\n",
      'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const stream = createMockStream(rawChunks);
    const parsed: string[] = [];

    for await (const chunk of parseSSEStream(stream)) {
      if (chunk.content) parsed.push(chunk.content);
    }

    expect(parsed.join("")).toBe("OK");
  });

  it("handles chunks split across packet boundaries", async () => {
    const rawChunks = [
      'data: {"choices":[{"delta":{',
      '"content":"Terbagi"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const stream = createMockStream(rawChunks);

    const parsed: string[] = [];
    for await (const chunk of parseSSEStream(stream)) {
      if (chunk.content) parsed.push(chunk.content);
    }

    expect(parsed.join("")).toBe("Terbagi");
  });

  it("regression: handles hundreds of reasoning_content chunks followed by content chunks without dropping", async () => {
    const rawChunks: string[] = [];
    const reasoningCount = 150;
    const contentCount = 50;

    // Simulate 150 reasoning chunks
    for (let i = 0; i < reasoningCount; i++) {
      rawChunks.push(`data: {"choices":[{"delta":{"reasoning_content":"think_${i} "}}]}\n\n`);
    }

    // Simulate transition to 50 content chunks
    for (let i = 0; i < contentCount; i++) {
      rawChunks.push(`data: {"choices":[{"delta":{"content":"word_${i} "}}]}\n\n`);
    }

    rawChunks.push('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
    rawChunks.push("data: [DONE]\n\n");

    let onRawChunkCalls = 0;
    const stream = createMockStream(rawChunks);
    const receivedReasoning: string[] = [];
    const receivedContent: string[] = [];
    let finishedReason: string | null = null;

    for await (const chunk of parseSSEStream(stream, () => onRawChunkCalls++)) {
      if (chunk.reasoningContent) receivedReasoning.push(chunk.reasoningContent);
      if (chunk.content) receivedContent.push(chunk.content);
      if (chunk.finishReason) finishedReason = chunk.finishReason;
    }

    expect(receivedReasoning.length).toBe(150);
    expect(receivedContent.length).toBe(50);
    expect(receivedReasoning[0]).toBe("think_0 ");
    expect(receivedReasoning[149]).toBe("think_149 ");
    expect(receivedContent[0]).toBe("word_0 ");
    expect(receivedContent[49]).toBe("word_49 ");
    expect(finishedReason).toBe("stop");
    expect(onRawChunkCalls).toBe(rawChunks.length);
  });

  it("regression: handles SSE JSON fragmented arbitrarily across multiple reader reads", async () => {
    const fullMessage = 'data: {"choices":[{"delta":{"content":"Fragmented Stream Works Perfectly!"}}]}\n\n';
    // Split into tiny 3-byte network packets
    const tinyPackets: string[] = [];
    for (let i = 0; i < fullMessage.length; i += 3) {
      tinyPackets.push(fullMessage.slice(i, i + 3));
    }

    const stream = createMockStream(tinyPackets);
    const results: string[] = [];

    for await (const chunk of parseSSEStream(stream)) {
      if (chunk.content) results.push(chunk.content);
    }

    expect(results.join("")).toBe("Fragmented Stream Works Perfectly!");
  });
});
