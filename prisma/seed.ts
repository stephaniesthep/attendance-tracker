import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Utility functions for logging
function logMessage(message: string, type: "info" | "success" | "error" = "info") {
  const prefix = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  console.log(`${prefix} ${message}`);
}

async function withErrorHandling<T>(
  fn: () => Promise<T>,
  operation: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logMessage(`Error in ${operation}: ${error}`, "error");
    throw error;
  }
}

/**
 * Creates permission records in the database
 */
async function createPermissions() {
  return withErrorHandling(async () => {
    logMessage("Creating permissions...", "info");

    // First, delete all existing permissions to avoid conflicts
    await prisma.permission.deleteMany({});

    const validEntities = [
      "users",
      "attendance", 
      "reports",
      "settings",
    ];

    const validActions = ["create", "read", "update", "delete"];
    const validAccess = ["own", "department", "all"];

    const permissions = [];

    for (const entity of validEntities) {
      for (const action of validActions) {
        for (const access of validAccess) {
          // Skip certain combinations that don't make sense
          if (entity === "settings" && access === "own") continue;

          const permission = await prisma.permission.create({
            data: {
              action,
              entity,
              access,
              description: `Can ${action} ${access} ${entity}`,
            },
          });

          permissions.push(permission);
        }
      }
    }

    logMessage(`Created ${permissions.length} permissions`, "success");
    return permissions;
  }, "createPermissions");
}

/**
 * Creates standard roles for the attendance tracking system
 */
async function createStandardRoles(permissions: any[]) {
  return withErrorHandling(async () => {
    logMessage("Creating roles...", "info");

    // Delete existing roles
    await prisma.role.deleteMany({});

    // SUPERADMIN gets all permissions
    const superadminPermissions = permissions;

    const superadminRole = await prisma.role.create({
      data: {
        name: "SUPERADMIN",
        displayName: "Super Administrator",
        description: "Full system access with all permissions",
        permissions: {
          connect: superadminPermissions.map(p => ({ id: p.id }))
        },
      },
    });

    // ADMIN gets department-level permissions
    const adminPermissions = permissions.filter(
      p => 
        // Full access to users in their department
        (p.entity === "users" && (p.access === "department" || p.access === "all")) ||
        // Full access to attendance in their department  
        (p.entity === "attendance" && (p.access === "department" || p.access === "all")) ||
        // Read access to reports for their department
        (p.entity === "reports" && p.action === "read" && (p.access === "department" || p.access === "all")) ||
        // No settings access for admins
        false
    );

    const adminRole = await prisma.role.create({
      data: {
        name: "ADMIN",
        displayName: "Administrator",
        description: "Department-level access to manage users and attendance",
        permissions: {
          connect: adminPermissions.map(p => ({ id: p.id }))
        },
      },
    });

    // WORKER gets only own-record permissions
    const workerPermissions = permissions.filter(
      p => 
        // Can read own user info and update own profile
        (p.entity === "users" && p.access === "own" && (p.action === "read" || p.action === "update")) ||
        // Can create, read, and update own attendance
        (p.entity === "attendance" && p.access === "own" && (p.action === "create" || p.action === "read" || p.action === "update"))
    );

    const workerRole = await prisma.role.create({
      data: {
        name: "WORKER",
        displayName: "Worker",
        description: "Basic access to manage own attendance and profile",
        permissions: {
          connect: workerPermissions.map(p => ({ id: p.id }))
        },
      },
    });

    logMessage("Created standard roles", "success");
    return {
      superadminRole,
      adminRole,
      workerRole
    };
  }, "createStandardRoles");
}

/**
 * Creates a user with the provided configuration
 */
async function createUser(config: {
  username: string;
  name: string;
  password: string;
  department?: string;
  roleIds: string[];
}) {
  return withErrorHandling(async () => {
    const hashedPassword = await bcrypt.hash(config.password, 10);

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: config.username },
      include: { roles: true }
    });

    if (existingUser) {
      // Update the existing user
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: config.name,
          department: config.department,
          roles: {
            set: [], // Clear existing roles
            connect: config.roleIds.map(id => ({ id }))
          },
          isActive: true,
        },
      });

      // Update password
      await prisma.password.upsert({
        where: { userId: existingUser.id },
        update: { hash: hashedPassword },
        create: {
          userId: existingUser.id,
          hash: hashedPassword
        }
      });

      logMessage(`Updated existing user: ${updatedUser.name}`, "success");
      return updatedUser;
    }

    // Create a new user
    const user = await prisma.user.create({
      data: {
        username: config.username,
        name: config.name,
        department: config.department,
        password: {
          create: { hash: hashedPassword }
        },
        roles: {
          connect: config.roleIds.map(id => ({ id }))
        },
        isActive: true,
      },
    });

    logMessage(`Created user: ${user.name}`, "success");
    return user;
  }, "createUser");
}

/**
 * Creates standard users for the system
 */
async function createStandardUsers(roles: {
  superadminRole: { id: string };
  adminRole: { id: string };
  workerRole: { id: string };
}) {
  logMessage("Creating users...", "info");

  // Create superadmin user
  const superadminUser = await createUser({
    username: "superadmin",
    name: "Super Administrator",
    password: "superadmin123",
    roleIds: [roles.superadminRole.id]
  });

  // Create admin users
  const admin1 = await createUser({
    username: "admin1",
    name: "John Admin",
    password: "admin123",
    department: "IT",
    roleIds: [roles.adminRole.id]
  });

  const admin2 = await createUser({
    username: "admin2",
    name: "Sarah Admin", 
    password: "admin123",
    department: "HR",
    roleIds: [roles.adminRole.id]
  });

  const admin3 = await createUser({
    username: "admin3",
    name: "Mike Admin",
    password: "admin123", 
    department: "Finance",
    roleIds: [roles.adminRole.id]
  });

  const admin4 = await createUser({
    username: "admin4",
    name: "Lisa Admin",
    password: "admin123",
    department: "Operations",
    roleIds: [roles.adminRole.id]
  });

  // Create 20 worker users across different departments
  const departments = ["IT", "HR", "Finance", "Operations", "Marketing"];
  const workers = [];

  for (let i = 1; i <= 20; i++) {
    const department = departments[(i - 1) % departments.length];
    const worker = await createUser({
      username: `worker${i}`,
      name: `Worker ${i}`,
      password: "worker123",
      department: department,
      roleIds: [roles.workerRole.id]
    });
    workers.push(worker);
  }

  logMessage(`Created ${workers.length} worker accounts`, "success");

  return {
    superadminUser,
    admins: [admin1, admin2, admin3, admin4],
    workers
  };
}

async function seed() {
  console.log("🌱 Seeding database with RBAC system...");

  try {
    // Create permissions
    const permissions = await createPermissions();

    // Create roles with permissions
    const roles = await createStandardRoles(permissions);

    // Create users with roles
    const users = await createStandardUsers(roles);

    console.log("\n📋 Test Credentials:");
    console.log("Superadmin login: superadmin / superadmin123");
    console.log("Admin login: admin1 / admin123 (IT Department)");
    console.log("Admin login: admin2 / admin123 (HR Department)");
    console.log("Admin login: admin3 / admin123 (Finance Department)");
    console.log("Admin login: admin4 / admin123 (Operations Department)");
    console.log("Worker login: worker1 / worker123 (IT Department)");
    console.log("Worker usernames: worker1 to worker20 (all with password: worker123)");
    console.log("Workers are distributed across: IT, HR, Finance, Operations, Marketing");
    console.log("\n✨ RBAC seed completed!");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });