import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@contextiq.app';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@1234';

async function main() {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { password: hashedPassword, isActive: true },
    create: {
      email: DEMO_EMAIL,
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
    },
  });

  const existingChatbot = await prisma.chatbot.findFirst({
    where: { userId: demoUser.id },
  });

  if (!existingChatbot) {
    await prisma.chatbot.create({
      data: {
        name: 'Demo Assistant',
        description:
          'A sample chatbot for the demo account. Upload a PDF or add a website to give it knowledge.',
        userId: demoUser.id,
      },
    });
  }

  console.log('Demo account ready:');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
