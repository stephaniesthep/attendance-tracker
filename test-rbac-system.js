import { PrismaClient } from "@prisma/client";
import { authenticateUser, getUserPrimaryRole } from "./app/utils/auth.server.js";
import { getUserWithPermissions, hasPermission } from "./app/utils/rbac.server.js";

const prisma = new PrismaClient();

async function testRBACSystem() {
  console.log("🧪 Testing RBAC System...\n");

  try {
    // Test 1: Check if superadmin user exists and can authenticate
    console.log("1️⃣ Testing superadmin authentication...");
    const superadminAuth = await authenticateUser("superadmin", "superadmin123");
    if (superadminAuth) {
      console.log("✅ Superadmin authentication successful");
      
      // Get superadmin role
      const superadminRole = await getUserPrimaryRole(superadminAuth.id);
      console.log(`✅ Superadmin primary role: ${superadminRole}`);
      
      // Check superadmin permissions
      const superadminWithPerms = await getUserWithPermissions(superadminAuth.id);
      console.log(`✅ Superadmin has ${superadminWithPerms.roles[0].permissions.length} permissions`);
      
      // Test specific permission
      const canManageUsers = await hasPermission(superadminAuth.id, "users", "create", "all");
      console.log(`✅ Superadmin can create all users: ${canManageUsers}`);
    } else {
      console.log("❌ Superadmin authentication failed");
    }

    console.log("\n2️⃣ Testing admin authentication...");
    const adminAuth = await authenticateUser("admin1", "admin123");
    if (adminAuth) {
      console.log("✅ Admin authentication successful");
      
      const adminRole = await getUserPrimaryRole(adminAuth.id);
      console.log(`✅ Admin primary role: ${adminRole}`);
      
      const adminWithPerms = await getUserWithPermissions(adminAuth.id);
      console.log(`✅ Admin has ${adminWithPerms.roles[0].permissions.length} permissions`);
      
      // Test admin permissions
      const canManageDeptUsers = await hasPermission(adminAuth.id, "users", "create", "department");
      const canManageAllUsers = await hasPermission(adminAuth.id, "users", "create", "all");
      console.log(`✅ Admin can create department users: ${canManageDeptUsers}`);
      console.log(`✅ Admin can create all users: ${canManageAllUsers}`);
    } else {
      console.log("❌ Admin authentication failed");
    }

    console.log("\n3️⃣ Testing worker authentication...");
    const workerAuth = await authenticateUser("worker1", "worker123");
    if (workerAuth) {
      console.log("✅ Worker authentication successful");
      
      const workerRole = await getUserPrimaryRole(workerAuth.id);
      console.log(`✅ Worker primary role: ${workerRole}`);
      
      const workerWithPerms = await getUserWithPermissions(workerAuth.id);
      console.log(`✅ Worker has ${workerWithPerms.roles[0].permissions.length} permissions`);
      
      // Test worker permissions
      const canReadOwnAttendance = await hasPermission(workerAuth.id, "attendance", "read", "own");
      const canReadAllAttendance = await hasPermission(workerAuth.id, "attendance", "read", "all");
      console.log(`✅ Worker can read own attendance: ${canReadOwnAttendance}`);
      console.log(`✅ Worker can read all attendance: ${canReadAllAttendance}`);
    } else {
      console.log("❌ Worker authentication failed");
    }

    console.log("\n4️⃣ Testing database structure...");
    const permissionCount = await prisma.permission.count();
    const roleCount = await prisma.role.count();
    const userCount = await prisma.user.count();
    
    console.log(`✅ Permissions in database: ${permissionCount}`);
    console.log(`✅ Roles in database: ${roleCount}`);
    console.log(`✅ Users in database: ${userCount}`);

    console.log("\n🎉 RBAC System Test Complete!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testRBACSystem();