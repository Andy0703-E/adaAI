const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const user = await prisma.user.findFirst({ where: { email: 'dadung2707@gmail.com' } });
  if (!user) throw new Error('User dadung2707@gmail.com not found');

  async function createConv(title, count) {
    const existing = await prisma.conversation.findFirst({
      where: { userId: user.id, title: title }
    });
    if (existing) {
      const msgCount = await prisma.message.count({ where: { conversationId: existing.id } });
      if (msgCount >= count) {
        console.log(`Using existing ${title} (ID: ${existing.id}, msgs: ${msgCount})`);
        return existing.id;
      }
      await prisma.conversation.delete({ where: { id: existing.id } });
    }

    const conv = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title,
        status: 'ACTIVE',
        providerKey: 'bandel-openai-compatible',
        modelId: 'deepseek-v4-flash',
      }
    });

    const msgs = [];
    for (let i = 1; i <= count; i++) {
      const isUser = i % 2 === 1;
      msgs.push({
        conversationId: conv.id,
        sequenceNo: i,
        role: isUser ? 'USER' : 'ASSISTANT',
        content: isUser
          ? `Ini adalah pertanyaan ke-${i} mengenai arsitektur sistem performa tinggi dan caching terdistribusi.`
          : `Berikut penjelasan detail untuk poin ke-${i}:\n\n1. Caching layer menggunakan Redis dengan TTL dinamis.\n2. Database indexing pada composite key.\n3. Stale-while-revalidate pattern untuk mengurangi latency upstream provider.\n\nImplementasi ini memastikan response time tetap di bawah 100ms.`,
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - (count - i) * 60000),
        updatedAt: new Date(Date.now() - (count - i) * 60000),
      });
    }

    await prisma.message.createMany({ data: msgs });
    console.log(`Created ${title} with ${count} messages (ID: ${conv.id})`);
    return conv.id;
  }

  const smallId = await createConv('Benchmark Dataset Small (10 msgs)', 10);
  const mediumId = await createConv('Benchmark Dataset Medium (75 msgs)', 75);
  const largeId = await createConv('Benchmark Dataset Large (300 msgs)', 300);

  console.log('RESULT:', JSON.stringify({ smallId, mediumId, largeId }));
}

seed().finally(() => prisma.$disconnect());
