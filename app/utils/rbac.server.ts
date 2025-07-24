import { prisma } from "./db.server";
import type { User, Role, Permission } from "@prisma/client";

// Types for RBAC
export type UserWithRoles = User & {
  roles: (Role & {
    permissions: Permission[];
  })[];
};

export type PermissionCheck = {
  action: string;
  entity: string;
  access: "own" | "department" | "all";
};

/**
 * Get user with roles and permissions
 */
export async function getUserWithPermissions(userId: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          permissions: true,
        },
      },
    },
  });
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permission: PermissionCheck,
  targetUserId?: string,
  targetDepartment?: string
): Promise<boolean> {
  const user = await getUserWithPermissions(userId);
  if (!user || !user.isActive) return false;

  // Get all user permissions from all roles
  const userPermissions = user.roles.flatMap(role => role.permissions);

  // Check for exact permission match
  const hasExactPermission = userPermissions.some(p => 
    p.action === permission.action &&
    p.entity === permission.entity &&
    p.access === permission.access
  );

  if (!hasExactPermission) return false;

  // Additional access control checks
  switch (permission.access) {
    case "own":
      // User can only access their own resources
      return !targetUserId || targetUserId === userId;
    
    case "department":
      // User can access resources within their department
      if (!user.department) return false;
      if (targetUserId) {
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { department: true },
        });
        return targetUser?.department === user.department;
      }
      if (targetDepartment) {
        return targetDepartment === user.department;
      }
      return true;
    
    case "all":
      // User can access all resources
      return true;
    
    default:
      return false;
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: PermissionCheck[],
  targetUserId?: string,
  targetDepartment?: string
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission, targetUserId, targetDepartment)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: PermissionCheck[],
  targetUserId?: string,
  targetDepartment?: string
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, permission, targetUserId, targetDepartment))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const user = await getUserWithPermissions(userId);
  if (!user) return [];

  return user.roles.flatMap(role => role.permissions);
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  const user = await getUserWithPermissions(userId);
  if (!user) return false;

  return user.roles.some(role => role.name === roleName);
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
  const user = await getUserWithPermissions(userId);
  if (!user) return false;

  return user.roles.some(role => roleNames.includes(role.name));
}

/**
 * Get users that the current user can manage based on permissions
 */
export async function getManagedUsers(userId: string): Promise<User[]> {
  const user = await getUserWithPermissions(userId);
  if (!user) return [];

  // Check if user can manage all users
  if (await hasPermission(userId, { action: "read", entity: "users", access: "all" })) {
    return prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  // Check if user can manage department users
  if (await hasPermission(userId, { action: "read", entity: "users", access: "department" })) {
    return prisma.user.findMany({
      where: { 
        department: user.department,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });
  }

  // User can only see themselves
  if (await hasPermission(userId, { action: "read", entity: "users", access: "own" })) {
    return [user];
  }

  return [];
}

/**
 * Get attendance records that the current user can access
 */
export async function getManagedAttendance(userId: string, filters?: {
  startDate?: string;
  endDate?: string;
  department?: string;
}) {
  const user = await getUserWithPermissions(userId);
  if (!user) return [];

  let whereClause: any = {};

  // Apply date filters if provided
  if (filters?.startDate || filters?.endDate) {
    whereClause.date = {};
    if (filters.startDate) whereClause.date.gte = filters.startDate;
    if (filters.endDate) whereClause.date.lte = filters.endDate;
  }

  // Check access level
  if (await hasPermission(userId, { action: "read", entity: "attendance", access: "all" })) {
    // Can access all attendance records
    if (filters?.department) {
      whereClause.user = { department: filters.department };
    }
  } else if (await hasPermission(userId, { action: "read", entity: "attendance", access: "department" })) {
    // Can access department attendance records
    whereClause.user = { department: user.department };
  } else if (await hasPermission(userId, { action: "read", entity: "attendance", access: "own" })) {
    // Can only access own attendance records
    whereClause.userId = userId;
  } else {
    return [];
  }

  return prisma.attendance.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          department: true,
        },
      },
    },
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" },
    ],
  });
}

/**
 * Permission constants for common operations
 */
export const PERMISSIONS = {
  // User management
  USERS_CREATE_ALL: { action: "create", entity: "users", access: "all" as const },
  USERS_READ_ALL: { action: "read", entity: "users", access: "all" as const },
  USERS_UPDATE_ALL: { action: "update", entity: "users", access: "all" as const },
  USERS_DELETE_ALL: { action: "delete", entity: "users", access: "all" as const },
  
  USERS_CREATE_DEPARTMENT: { action: "create", entity: "users", access: "department" as const },
  USERS_READ_DEPARTMENT: { action: "read", entity: "users", access: "department" as const },
  USERS_UPDATE_DEPARTMENT: { action: "update", entity: "users", access: "department" as const },
  USERS_DELETE_DEPARTMENT: { action: "delete", entity: "users", access: "department" as const },
  
  USERS_READ_OWN: { action: "read", entity: "users", access: "own" as const },
  USERS_UPDATE_OWN: { action: "update", entity: "users", access: "own" as const },

  // Attendance management
  ATTENDANCE_CREATE_ALL: { action: "create", entity: "attendance", access: "all" as const },
  ATTENDANCE_READ_ALL: { action: "read", entity: "attendance", access: "all" as const },
  ATTENDANCE_UPDATE_ALL: { action: "update", entity: "attendance", access: "all" as const },
  ATTENDANCE_DELETE_ALL: { action: "delete", entity: "attendance", access: "all" as const },
  
  ATTENDANCE_READ_DEPARTMENT: { action: "read", entity: "attendance", access: "department" as const },
  ATTENDANCE_UPDATE_DEPARTMENT: { action: "update", entity: "attendance", access: "department" as const },
  
  ATTENDANCE_CREATE_OWN: { action: "create", entity: "attendance", access: "own" as const },
  ATTENDANCE_READ_OWN: { action: "read", entity: "attendance", access: "own" as const },
  ATTENDANCE_UPDATE_OWN: { action: "update", entity: "attendance", access: "own" as const },

  // Reports
  REPORTS_READ_ALL: { action: "read", entity: "reports", access: "all" as const },
  REPORTS_READ_DEPARTMENT: { action: "read", entity: "reports", access: "department" as const },

  // Settings
  SETTINGS_CREATE_ALL: { action: "create", entity: "settings", access: "all" as const },
  SETTINGS_READ_ALL: { action: "read", entity: "settings", access: "all" as const },
  SETTINGS_UPDATE_ALL: { action: "update", entity: "settings", access: "all" as const },
  SETTINGS_DELETE_ALL: { action: "delete", entity: "settings", access: "all" as const },
} as const;

/**
 * Role constants
 */
export const ROLES = {
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN", 
  WORKER: "WORKER",
} as const;