import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating PostgreSQL pg_trgm extension and GIN indexes on Neon...");
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "conversations_title_trgm_idx" ON "conversations" USING GIN ("title" gin_trgm_ops);`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "messages_content_trgm_idx" ON "messages" USING GIN ("content" gin_trgm_ops);`
    );
    console.log("SUCCESS: pg_trgm extension and GIN indexes created successfully on Neon!");
  } catch (err) {
    console.error("Failed creating indexes:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
