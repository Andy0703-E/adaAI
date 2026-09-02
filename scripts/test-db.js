const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const [users, conversations, settings] = await Promise.all([
    prisma.user.count(),
    prisma.conversation.count(),
    prisma.userSettings.count(),
  ]);

  console.log(
    `Prisma database check passed (users: ${users}, conversations: ${conversations}, settings: ${settings}).`,
  );
}

main()
  .catch((error) => {
    console.error("Prisma database check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
