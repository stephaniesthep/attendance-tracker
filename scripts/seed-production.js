import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('🌱 Seeding production database...');

  // Hash the default password
  const hashedPassword = await bcrypt.hash('superadmin123', 10);

  // Create superadmin user
  const superadmin = await prisma.superAdmin.upsert({
    where: { email: 'superadmin@example.com' },
    update: {},
    create: {
      email: 'superadmin@example.com',
      password: hashedPassword,
      name: 'Super Administrator',
      superadminVerifyCode: 'SUPER2024'
    }
  });

  console.log('✅ Created superadmin user:', superadmin.email);

  // Create a sample regular user
  const hashedUserPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: hashedUserPassword,
      name: 'Sample User',
      role: 'user'
    }
  });

  console.log('✅ Created sample user:', user.email);
  console.log('🎉 Production database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });