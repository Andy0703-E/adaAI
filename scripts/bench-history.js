// Benchmark: Conversation History & Search — Direct DB
// Seeds 30, 100, 300, 1000 total conversations, then queries limit=30 each time

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function benchmarkHistory(userId, totalLabel) {
  const t0 = performance.now();

  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      status: { not: "ARCHIVED" },
    },
    take: 31, // limit+1 for hasNextPage detection
    orderBy: [
      { lastMessageAt: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      title: true,
      status: true,
      modelId: true,
      providerKey: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const queryMs = Math.round(performance.now() - t0);

  const hasNextPage = conversations.length > 30;
  if (hasNextPage) conversations.pop();

  const json = JSON.stringify(conversations);
  const payloadBytes = Buffer.byteLength(json, "utf8");
  const totalMs = Math.round(performance.now() - t0);

  return { queryMs, totalMs, rowCount: conversations.length, payloadBytes, hasNextPage };
}

async function benchmarkSearch(userId, query) {
  const t0 = performance.now();

  const [titleMatches, messageMatches] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId, title: { contains: query, mode: "insensitive" } },
      select: { id: true, title: true, lastMessageAt: true },
      take: 20,
    }),
    prisma.message.findMany({
      where: {
        content: { contains: query, mode: "insensitive" },
        conversation: { userId },
      },
      select: {
        content: true,
        conversationId: true,
        conversation: { select: { id: true, title: true, lastMessageAt: true } },
      },
      take: 40,
    }),
  ]);
  const queryMs = Math.round(performance.now() - t0);
  const totalMs = Math.round(performance.now() - t0);

  return { queryMs, totalMs, titleHits: titleMatches.length, contentHits: messageMatches.length };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "dadung2707@gmail.com" } });
  if (!user) throw new Error("User not found");

  console.log("=== Conversation History Benchmark (limit=30) ===\n");

  // Count actual conversations
  const totalCount = await prisma.conversation.count({ where: { userId: user.id } });
  console.log("Total conversations in DB: " + totalCount);

  // Run 3 times, use median
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const r = await benchmarkHistory(user.id, totalCount.toString());
    runs.push(r);
  }
  runs.sort((a, b) => a.queryMs - b.queryMs);
  const best = runs[Math.floor(runs.length / 2)];

  console.log("[PERF CONVERSATIONS] {");
  console.log("  queryMs:        " + best.queryMs);
  console.log("  totalMs:        " + best.totalMs);
  console.log("  rowCount:       " + best.rowCount);
  console.log("  payloadBytes:   " + best.payloadBytes + " (" + Math.round(best.payloadBytes / 1024) + " KB)");
  console.log("  hasNextPage:    " + best.hasNextPage);
  console.log("}");
  console.log("");

  console.log("=== Search Benchmark ===\n");
  const searchTerms = ["halo", "arsitektur", "Benchmark"];
  for (const term of searchTerms) {
    const runs2 = [];
    for (let i = 0; i < 3; i++) {
      const r = await benchmarkSearch(user.id, term);
      runs2.push(r);
    }
    runs2.sort((a, b) => a.queryMs - b.queryMs);
    const b = runs2[Math.floor(runs2.length / 2)];
    console.log('[PERF SEARCH] query="' + term + '" { queryMs: ' + b.queryMs + ', titleHits: ' + b.titleHits + ', contentHits: ' + b.contentHits + ' }');
  }

  console.log("\n=== Summary Table ===");
  console.log("TotalConvs | Limit | QueryMs | Payload | HasNextPage");
  console.log("-----------|-------|---------|---------|------------");
  console.log(String(totalCount).padStart(10) + " |    30 | " + String(best.queryMs + "ms").padStart(7) + " | " + String(Math.round(best.payloadBytes / 1024) + " KB").padStart(7) + " | " + best.hasNextPage);
}

main().finally(() => prisma["$disconnect"]());
