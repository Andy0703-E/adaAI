// Direct DB benchmark - bypasses HTTP/auth layer
// Measures pure database query time for conversation warm load

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const datasets = [
  { label: "Small",  id: "ef3d8be3-54ce-4dfe-8ce9-169a2326d334", expectedMsgs: 10 },
  { label: "Medium", id: "61dcd2d0-5206-4090-8858-0b6002c9e7c2", expectedMsgs: 75 },
  { label: "Large",  id: "3f94c9cc-f066-494e-ac1c-d05f03c7b021", expectedMsgs: 300 },
];

async function benchmarkOne(dataset, run) {
  const t0 = performance.now();

  // Parallel: conversation + messages simultaneously
  const tQuery = performance.now();
  const [conversation, messages] = await Promise.all([
    prisma.conversation.findFirst({
      where: { id: dataset.id },
      select: { id: true, title: true, modelId: true, createdAt: true, updatedAt: true },
    }),
    prisma.message.findMany({
      where: { conversationId: dataset.id },
      select: {
        id: true,
        conversationId: true,
        sequenceNo: true,
        role: true,
        content: true,
        status: true,
        providerKey: true,
        modelId: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        finishReason: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const parallelQueryMs = Math.round(performance.now() - tQuery);

  if (!conversation) throw new Error("Conversation " + dataset.id + " not found");

  const totalMs = Math.round(performance.now() - t0);

  const json = JSON.stringify(messages);
  const payloadBytes = Buffer.byteLength(json, "utf8");
  const payloadKb = Math.round(payloadBytes / 1024);

  return { parallelQueryMs, totalMs, payloadKb, messageCount: messages.length };
}

async function main() {
  console.log("=== Conversation Warm Load — Direct DB Benchmark ===\n");

  // Warm-up round (prime Prisma connection pool)
  await prisma.conversation.findFirst({ where: { id: datasets[0].id } });

  const results = [];

  for (const ds of datasets) {
    // Run 3 times, report median as warm
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const r = await benchmarkOne(ds, i + 1);
      runs.push(r);
    }

    runs.sort((a, b) => a.parallelQueryMs - b.parallelQueryMs);
    const best = runs[Math.floor(runs.length / 2)];

    console.log("[PERF CHAT PAGE] dataset=" + ds.label + " {");
    console.log("  parallelQueryMs:     " + best.parallelQueryMs);
    console.log("  totalMs:             " + best.totalMs);
    console.log("  messageCount:        " + best.messageCount);
    console.log("}");
    console.log("[PERF CHAT PAYLOAD] dataset=" + ds.label + " {");
    console.log("  kb:                  " + best.payloadKb);
    console.log("  messageCount:        " + best.messageCount);
    console.log("}");
    console.log("");

    results.push({ ...ds, ...best });
  }

  console.log("=== Summary Table (Parallel Queries) ===");
  console.log("Dataset  | Msgs | ParallelQ | Total  | Payload");
  console.log("---------|------|-----------|--------|--------");
  for (const r of results) {
    console.log(
      r.label.padEnd(8) + " | " +
      String(r.messageCount).padStart(4) + " | " +
      String(r.parallelQueryMs + "ms").padStart(9) + " | " +
      String(r.totalMs + "ms").padStart(6) + " | " +
      String(r.payloadKb + " KB").padStart(7)
    );
  }
}

main().finally(() => prisma["$disconnect"]());
