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

  // Hash passwords
  const superadminPassword = await bcrypt.hash('superadmin123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const workerPassword = await bcrypt.hash('worker123', 10);

  // Create superadmin user
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin' },
    update: {},
    create: {
      email: 'superadmin',
      password: superadminPassword,
      name: 'Super Administrator',
      role: 'SUPERADMIN'
    }
  });

  console.log('✅ Created superadmin user:', superadmin.email);

  // Create separate SuperAdmin record
  const superAdminRecord = await prisma.superAdmin.upsert({
    where: { email: 'superadmin' },
    update: {},
    create: {
      email: 'superadmin',
      password: superadminPassword,
      name: 'Super Administrator',
      superadminVerifyCode: '12031999'
    }
  });

  console.log('✅ Created superadmin record:', superAdminRecord.email);

  // Create admin users
  const adminUsers = [
    { email: 'admin1', name: 'John Admin' },
    { email: 'admin2', name: 'Sarah Admin' },
    { email: 'admin3', name: 'Mike Admin' },
    { email: 'admin4', name: 'Lisa Admin' }
  ];

  for (const admin of adminUsers) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        email: admin.email,
        password: adminPassword,
        name: admin.name,
        role: 'ADMIN'
      }
    });
  }

  console.log(`✅ Created ${adminUsers.length} admin users`);

  // Create worker users
  const workerData = [
    { email: 'worker1', name: 'Alice Worker' },
    { email: 'worker2', name: 'Bob Worker' },
    { email: 'worker3', name: 'Charlie Worker' },
    { email: 'worker4', name: 'Diana Worker' },
    { email: 'worker5', name: 'Eve Worker' },
    { email: 'worker6', name: 'Frank Worker' },
    { email: 'worker7', name: 'Grace Worker' },
    { email: 'worker8', name: 'Henry Worker' },
    { email: 'worker9', name: 'Ivy Worker' },
    { email: 'worker10', name: 'Jack Worker' }
  ];

  for (const worker of workerData) {
    await prisma.user.upsert({
      where: { email: worker.email },
      update: {},
      create: {
        email: worker.email,
        password: workerPassword,
        name: worker.name,
        role: 'user'
      }
    });
  }

  console.log(`✅ Created ${workerData.length} worker users`);

  console.log('\n📋 Production Test Credentials:');
  console.log('Superadmin: superadmin / superadmin123');
  console.log('Admin: admin1 / admin123');
  console.log('Worker: worker1 / worker123');
  console.log('\nSuperadmin verification code: 12031999');
  console.log('\n🎉 Production database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });