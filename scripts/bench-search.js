const { PrismaClient } = require("@prisma/client");

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function withRetry(fn, retries = 8, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries - 1) throw e;
      process.stdout.write("  Neon wake-up attempt " + (i + 1) + "/" + retries + "... ");
      await sleep(delayMs);
      console.log("retrying");
    }
  }
}

async function benchSearch(prisma, userId, q) {
  const searchContent = q.length >= 3;
  const t0 = performance.now();
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      status: { not: "ARCHIVED" },
      OR: searchContent
        ? [
            { title: { contains: q, mode: "insensitive" } },
            { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
          ]
        : [{ title: { contains: q, mode: "insensitive" } }],
    },
    select: {
      id: true, title: true, lastMessageAt: true,
    },
    orderBy: { lastMessageAt: "desc" },
    take: 40,
  });
  const queryMs = Math.round(performance.now() - t0);
  const titleHits = conversations.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())).length;
  return { queryMs, resultCount: conversations.length, titleHits, contentHits: conversations.length - titleHits, searchContent };
}

async function main() {
  const prisma = new PrismaClient({ log: [] });
  console.log("Waking up Neon DB...");
  const user = await withRetry(() => prisma.user.findFirst({ where: { email: "dadung2707@gmail.com" } }));
  if (!user) throw new Error("User not found");
  console.log("DB online. Running benchmarks...\n");

  const queries = ["Benchmark", "arsitektur", "halo"];
  console.log("=== Search Benchmark: Single Round-Trip ===\n");
  console.log("Query        | QueryMs | Results | Mode");
  console.log("-------------|---------|---------|------");

  for (const q of queries) {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await benchSearch(prisma, user.id, q));
    runs.sort((a, b) => a.queryMs - b.queryMs);
    const r = runs[Math.floor(runs.length / 2)];
    
    console.log(
      ('"' + q + '"').padEnd(13) + " | " + String(r.queryMs + "ms").padStart(7) + " | " +
      String(r.resultCount).padStart(7) + " | " + (r.searchContent ? "title+content" : "title only")
    );
  }

  await prisma["$disconnect"]();
}

main().catch((e) => { console.error("\nFailed:", e.message); process.exit(1); });
