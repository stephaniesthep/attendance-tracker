import { PrismaClient } from "@prisma/client";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  // Create superadmin in the superadmins table (separate from users)
  const superadminPassword = await bcrypt.hash("superadmin123", 10);
  
  // Check if superadmin already exists
  const existingSuperadmin = await prisma.superadmins.findUnique({
    where: { email: "superadmin@company.com" }
  });

  if (!existingSuperadmin) {
    const superadmin = await prisma.superadmins.create({
      data: {
        email: "superadmin@company.com",
        password: superadminPassword,
        name: "Super Administrator",
        superadminVerifyCode: "12031999",
      },
    });
    console.log(`✅ Created superadmin: ${superadmin.email}`);
  } else {
    console.log(`ℹ️ Superadmin already exists: ${existingSuperadmin.email}`);
  }

  // Create admin users in the users table
  const adminPassword = await bcrypt.hash("admin123", 10);
  
  const adminData = [
    { email: "admin1@company.com", username: "admin1", name: "John Admin" },
    { email: "admin2@company.com", username: "admin2", name: "Sarah Admin" },
    { email: "admin3@company.com", username: "admin3", name: "Mike Admin" },
    { email: "admin4@company.com", username: "admin4", name: "Lisa Admin" },
  ];

  const admins = [];
  for (const admin of adminData) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: admin.email }
    });

    if (!existingAdmin) {
      const newAdmin = await prisma.user.create({
        data: {
          email: admin.email,
          username: admin.username,
          password: adminPassword,
          name: admin.name,
          role: "ADMIN",
        },
      });
      admins.push(newAdmin);
      console.log(`✅ Created admin: ${newAdmin.username} (${newAdmin.email})`);
    } else {
      console.log(`ℹ️ Admin already exists: ${existingAdmin.username || existingAdmin.email}`);
    }
  }

  // Create regular users
  const userPassword = await bcrypt.hash("user123", 10);
  
  const users: User[] = [];
  for (let i = 1; i <= 10; i++) {
    const email = `user${i}@company.com`;
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          email,
          password: userPassword,
          name: `User ${i}`,
          role: "user",
        },
      });
      users.push(user);
    }
  }

  console.log(`✅ Created ${users.length} regular users`);

  console.log("\n📋 Test Credentials:");
  console.log("Superadmin login: superadmin@company.com / superadmin123");
  console.log("Admin login: admin1@company.com / admin123");
  console.log("User login: user1@company.com / user123");
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