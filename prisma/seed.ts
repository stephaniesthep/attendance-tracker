import { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  // Create superadmin user
  const superadminPassword = await bcrypt.hash("superadmin123", 10);
  const superadmin = await prisma.user.create({
    data: {
      username: "superadmin",
      password: superadminPassword,
      name: "Super Administrator",
      department: "System",
      role: "SUPERADMIN",
      superadminVerifyCode: "12031999", // Pre-set verification code
    },
  });

  console.log(`✅ Created superadmin user: ${superadmin.username}`);

  // Create admin users
  const adminPassword = await bcrypt.hash("admin123", 10);
  
  const admins = await Promise.all([
    prisma.user.create({
      data: {
        username: "admin1",
        password: adminPassword,
        name: "John Admin",
        department: "Management",
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        username: "admin2",
        password: adminPassword,
        name: "Sarah Admin",
        department: "HR",
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        username: "admin3",
        password: adminPassword,
        name: "Mike Admin",
        department: "Operations",
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        username: "admin4",
        password: adminPassword,
        name: "Lisa Admin",
        department: "Finance",
        role: "ADMIN",
      },
    }),
  ]);

  console.log(`✅ Created ${admins.length} admin users`);

  // Create worker users
  const workerPassword = await bcrypt.hash("worker123", 10);
  const departments = ["Engineering", "Sales", "Marketing", "Finance", "Support"];
  
  const workers: User[] = [];
  for (let i = 1; i <= 20; i++) {
    const worker = await prisma.user.create({
      data: {
        username: `worker${i}`,
        password: workerPassword,
        name: `Worker ${i}`,
        department: departments[Math.floor(Math.random() * departments.length)],
        role: "WORKER",
      },
    });
    workers.push(worker);
  }

  console.log(`✅ Created ${workers.length} worker users`);

  console.log("\n📋 Test Credentials:");
  console.log("Superadmin login: superadmin / superadmin123");
  console.log("Admin login: admin1 / admin123");
  console.log("Worker login: worker1 / worker123");
  console.log("\nSuperadmin verification code: 12031999");
  console.log("\n✨ Seed completed!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });