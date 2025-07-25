import { createCookieSessionStorage, redirect } from "react-router";
import { getUserFromToken, getUserPrimaryRole, userHasRole } from "./auth.server";
import { hasPermission, hasRole, PERMISSIONS, ROLES, getUserWithPermissions } from "./rbac.server";
import type { User } from "@prisma/client";
import type { PermissionCheck } from "./rbac.server";

const sessionSecret = process.env.SESSION_SECRET || "default-session-secret";

const storage = createCookieSessionStorage({
  cookie: {
    name: "attendance_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
  },
});

export async function createUserSession(token: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("token", token);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const token = session.get("token");
  if (!token || typeof token !== "string") {
    return null;
  }
  return token;
}

export async function requireUser(request: Request): Promise<User> {
  const token = await getUserSession(request);
  if (!token) {
    throw redirect("/login");
  }

  const user = await getUserFromToken(token);
  if (!user) {
    throw redirect("/login");
  }

  return user;
}

/**
 * Require user with specific permission
 */
export async function requirePermission(
  request: Request,
  permission: PermissionCheck,
  targetUserId?: string,
  targetDepartment?: string
): Promise<User> {
  const user = await requireUser(request);
  
  // Get user with permissions once to avoid redundant DB calls
  const userWithPermissions = await getUserWithPermissions(user.id);
  if (!userWithPermissions) {
    throw redirect("/login");
  }
  
  const hasRequiredPermission = await hasPermission(
    user.id,
    permission,
    targetUserId,
    targetDepartment,
    userWithPermissions
  );

  if (!hasRequiredPermission) {
    throw redirect("/dashboard");
  }

  return user;
}

/**
 * Require user with specific role
 */
export async function requireRole(request: Request, roleName: string): Promise<User> {
  const user = await requireUser(request);
  
  // Get user with roles once to avoid redundant DB calls
  const userWithRoles = await getUserWithPermissions(user.id);
  if (!userWithRoles) {
    throw redirect("/login");
  }
  
  const hasRequiredRole = await hasRole(user.id, roleName, userWithRoles);
  if (!hasRequiredRole) {
    throw redirect("/dashboard");
  }

  return user;
}

/**
 * Require user with any of the specified roles
 */
export async function requireAnyRole(request: Request, roleNames: string[]): Promise<User> {
  const user = await requireUser(request);
  
  // Get user with roles once to avoid redundant DB calls
  const userWithRoles = await getUserWithPermissions(user.id);
  if (!userWithRoles) {
    throw redirect("/login");
  }
  
  let hasAnyRequiredRole = false;
  for (const roleName of roleNames) {
    if (await hasRole(user.id, roleName, userWithRoles)) {
      hasAnyRequiredRole = true;
      break;
    }
  }

  if (!hasAnyRequiredRole) {
    throw redirect("/dashboard");
  }

  return user;
}

// Legacy compatibility functions - these use the new RBAC system under the hood
export async function requireAdmin(request: Request): Promise<User> {
  return requireAnyRole(request, [ROLES.ADMIN, ROLES.SUPERADMIN]);
}

export async function requireSuperAdmin(request: Request): Promise<User> {
  return requireRole(request, ROLES.SUPERADMIN);
}

export async function requireAdminOrSuperAdmin(request: Request): Promise<User> {
  return requireAnyRole(request, [ROLES.ADMIN, ROLES.SUPERADMIN]);
}

// Specific permission-based requirements for common operations
export async function requireUserManagement(request: Request): Promise<User> {
  const user = await requireUser(request);
  
  // Check if user can manage users at any level
  const canManageUsers = await hasPermission(user.id, PERMISSIONS.USERS_CREATE_ALL) ||
                        await hasPermission(user.id, PERMISSIONS.USERS_CREATE_DEPARTMENT);

  if (!canManageUsers) {
    throw redirect("/dashboard");
  }

  return user;
}

export async function requireAttendanceManagement(request: Request): Promise<User> {
  const user = await requireUser(request);
  
  // Check if user can manage attendance at any level
  const canManageAttendance = await hasPermission(user.id, PERMISSIONS.ATTENDANCE_READ_ALL) ||
                             await hasPermission(user.id, PERMISSIONS.ATTENDANCE_READ_DEPARTMENT);

  if (!canManageAttendance) {
    throw redirect("/dashboard");
  }

  return user;
}

export async function requireReportsAccess(request: Request): Promise<User> {
  const user = await requireUser(request);
  
  // Check if user can access reports at any level
  const canAccessReports = await hasPermission(user.id, PERMISSIONS.REPORTS_READ_ALL) ||
                          await hasPermission(user.id, PERMISSIONS.REPORTS_READ_DEPARTMENT);

  if (!canAccessReports) {
    throw redirect("/dashboard");
  }

  return user;
}

export async function requireSettingsAccess(request: Request): Promise<User> {
  return requirePermission(request, PERMISSIONS.SETTINGS_READ_ALL);
}

/**
 * Check if current user can access a specific user's data
 */
export async function requireUserAccess(
  request: Request,
  targetUserId: string
): Promise<User> {
  const user = await requireUser(request);
  
  // Check if user can access the target user's data
  const canAccessUser = await hasPermission(user.id, PERMISSIONS.USERS_READ_ALL) ||
                       await hasPermission(user.id, PERMISSIONS.USERS_READ_DEPARTMENT, targetUserId) ||
                       await hasPermission(user.id, PERMISSIONS.USERS_READ_OWN, targetUserId);

  if (!canAccessUser) {
    throw redirect("/dashboard");
  }

  return user;
}

/**
 * Check if current user can access a specific user's attendance
 */
export async function requireAttendanceAccess(
  request: Request,
  targetUserId: string
): Promise<User> {
  const user = await requireUser(request);
  
  // Check if user can access the target user's attendance
  const canAccessAttendance = await hasPermission(user.id, PERMISSIONS.ATTENDANCE_READ_ALL) ||
                             await hasPermission(user.id, PERMISSIONS.ATTENDANCE_READ_DEPARTMENT, targetUserId) ||
                             await hasPermission(user.id, PERMISSIONS.ATTENDANCE_READ_OWN, targetUserId);

  if (!canAccessAttendance) {
    throw redirect("/dashboard");
  }

  return user;
}

export async function logout(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

/**
 * Get user's redirect path based on their primary role
 */
export function getUserDashboardPath(user: User & { roles?: { name: string }[] }): string {
  if (!user.roles || user.roles.length === 0) {
    return "/attendance"; // Default for workers
  }

  const primaryRole = getUserPrimaryRole(user as User & { roles: { name: string }[] });
  
  switch (primaryRole) {
    case ROLES.SUPERADMIN:
      return "/superadmin";
    case ROLES.ADMIN:
      return "/admin";
    case ROLES.WORKER:
    default:
      return "/attendance";
  }
}