import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let dbConnected: boolean | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 30000;

export async function isDatabaseAvailable(): Promise<boolean> {
  const now = Date.now();
  if (dbConnected === false && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return false;
  }
  lastCheckTime = now;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    return true;
  } catch {
    dbConnected = false;
    return false;
  }
}
