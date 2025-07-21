import { PrismaClient, User, Attendance } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

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

  // Create some sample attendance records for today
  const today = new Date();
  const sampleAttendance: Attendance[] = [];
  
  // Create attendance for some workers
  for (let i = 0; i < 10; i++) {
    const worker = workers[i];
    const checkInTime = new Date(today);
    checkInTime.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
    
    const hasCheckedOut = Math.random() > 0.3; // 70% have checked out
    let checkOutTime: Date | null = null;
    let duration: number | null = null;
    
    if (hasCheckedOut) {
      checkOutTime = new Date(checkInTime);
      checkOutTime.setHours(checkOutTime.getHours() + 8 + Math.floor(Math.random() * 2));
      duration = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 1000 / 60);
    }
    
    const attendance = await prisma.attendance.create({
      data: {
        userId: worker.id,
        date: today,
        checkInTime,
        checkInPhoto: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgABAAA=",
        checkInLocation: JSON.stringify({
          lat: -6.2088 + (Math.random() - 0.5) * 0.01,
          lng: 106.8456 + (Math.random() - 0.5) * 0.01,
        }),
        checkOutTime,
        checkOutPhoto: hasCheckedOut ? "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgABAAA=" : null,
        checkOutLocation: hasCheckedOut ? JSON.stringify({
          lat: -6.2088 + (Math.random() - 0.5) * 0.01,
          lng: 106.8456 + (Math.random() - 0.5) * 0.01,
        }) : null,
        duration,
      },
    });
    sampleAttendance.push(attendance);
  }

  console.log(`✅ Created ${sampleAttendance.length} attendance records`);

  console.log("\n📋 Test Credentials:");
  console.log("Admin login: admin1 / admin123");
  console.log("Worker login: worker1 / worker123");
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