import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireUser, requirePermission, requireRole, requireAnyRole } from "./session.server";
import { hasPermission, hasRole, hasAnyRole } from "./rbac.server";
import type { PermissionCheck } from "./rbac.server";
import type { User } from "@prisma/client";

/**
 * Higher-order function to protect routes with permission checks
 */
export function withPermission(
  permission: PermissionCheck,
  targetUserIdExtractor?: (args: LoaderFunctionArgs | ActionFunctionArgs) => string | undefined,
  targetDepartmentExtractor?: (args: LoaderFunctionArgs | ActionFunctionArgs) => string | undefined
) {
  return function <T extends LoaderFunctionArgs | ActionFunctionArgs>(
    handler: (args: T & { user: User }) => Promise<any> | any
  ) {
    return async (args: T) => {
      const user = await requireUser(args.request);
      
      const targetUserId = targetUserIdExtractor?.(args);
      const targetDepartment = targetDepartmentExtractor?.(args);
      
      const hasRequiredPermission = await hasPermission(
        user.id,
        permission,
        targetUserId,
        targetDepartment
      );

      if (!hasRequiredPermission) {
        throw redirect("/dashboard");
      }

      return handler({ ...args, user });
    };
  };
}

/**
 * Higher-order function to protect routes with role checks
 */
export function withRole(roleName: string) {
  return function <T extends LoaderFunctionArgs | ActionFunctionArgs>(
    handler: (args: T & { user: User }) => Promise<any> | any
  ) {
    return async (args: T) => {
      const user = await requireRole(args.request, roleName);
      return handler({ ...args, user });
    };
  };
}

/**
 * Higher-order function to protect routes with multiple role options
 */
export function withAnyRole(roleNames: string[]) {
  return function <T extends LoaderFunctionArgs | ActionFunctionArgs>(
    handler: (args: T & { user: User }) => Promise<any> | any
  ) {
    return async (args: T) => {
      const user = await requireAnyRole(args.request, roleNames);
      return handler({ ...args, user });
    };
  };
}

/**
 * Higher-order function for superadmin-only routes
 */
export function withSuperAdmin<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return withRole("SUPERADMIN")(handler);
}

/**
 * Higher-order function for admin or superadmin routes
 */
export function withAdmin<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return withAnyRole(["ADMIN", "SUPERADMIN"])(handler);
}

/**
 * Higher-order function for authenticated routes (any role)
 */
export function withAuth<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return async (args: T) => {
    const user = await requireUser(args.request);
    return handler({ ...args, user });
  };
}

/**
 * Middleware for user management routes
 */
export function withUserManagement<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return async (args: T) => {
    const user = await requireUser(args.request);
    
    // Check if user can manage users at any level
    const canManageUsers = await hasPermission(user.id, { action: "create", entity: "users", access: "all" }) ||
                          await hasPermission(user.id, { action: "create", entity: "users", access: "department" });

    if (!canManageUsers) {
      throw redirect("/dashboard");
    }

    return handler({ ...args, user });
  };
}

/**
 * Middleware for attendance management routes
 */
export function withAttendanceManagement<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return async (args: T) => {
    const user = await requireUser(args.request);
    
    // Check if user can manage attendance at any level
    const canManageAttendance = await hasPermission(user.id, { action: "read", entity: "attendance", access: "all" }) ||
                               await hasPermission(user.id, { action: "read", entity: "attendance", access: "department" });

    if (!canManageAttendance) {
      throw redirect("/dashboard");
    }

    return handler({ ...args, user });
  };
}

/**
 * Middleware for reports access
 */
export function withReportsAccess<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return async (args: T) => {
    const user = await requireUser(args.request);
    
    // Check if user can access reports at any level
    const canAccessReports = await hasPermission(user.id, { action: "read", entity: "reports", access: "all" }) ||
                            await hasPermission(user.id, { action: "read", entity: "reports", access: "department" });

    if (!canAccessReports) {
      throw redirect("/dashboard");
    }

    return handler({ ...args, user });
  };
}

/**
 * Middleware for settings access
 */
export function withSettingsAccess<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  handler: (args: T & { user: User }) => Promise<any> | any
) {
  return withPermission({ action: "read", entity: "settings", access: "all" })(handler);
}

/**
 * Middleware to check access to specific user data
 */
export function withUserAccess(
  userIdExtractor: (args: LoaderFunctionArgs | ActionFunctionArgs) => string
) {
  return function <T extends LoaderFunctionArgs | ActionFunctionArgs>(
    handler: (args: T & { user: User; targetUserId: string }) => Promise<any> | any
  ) {
    return async (args: T) => {
      const user = await requireUser(args.request);
      const targetUserId = userIdExtractor(args);
      
      // Check if user can access the target user's data
      const canAccessUser = await hasPermission(user.id, { action: "read", entity: "users", access: "all" }) ||
                           await hasPermission(user.id, { action: "read", entity: "users", access: "department" }, targetUserId) ||
                           await hasPermission(user.id, { action: "read", entity: "users", access: "own" }, targetUserId);

      if (!canAccessUser) {
        throw redirect("/dashboard");
      }

      return handler({ ...args, user, targetUserId });
    };
  };
}

/**
 * Middleware to check access to specific attendance data
 */
export function withAttendanceAccess(
  userIdExtractor: (args: LoaderFunctionArgs | ActionFunctionArgs) => string
) {
  return function <T extends LoaderFunctionArgs | ActionFunctionArgs>(
    handler: (args: T & { user: User; targetUserId: string }) => Promise<any> | any
  ) {
    return async (args: T) => {
      const user = await requireUser(args.request);
      const targetUserId = userIdExtractor(args);
      
      // Check if user can access the target user's attendance
      const canAccessAttendance = await hasPermission(user.id, { action: "read", entity: "attendance", access: "all" }) ||
                                 await hasPermission(user.id, { action: "read", entity: "attendance", access: "department" }, targetUserId) ||
                                 await hasPermission(user.id, { action: "read", entity: "attendance", access: "own" }, targetUserId);

      if (!canAccessAttendance) {
        throw redirect("/dashboard");
      }

      return handler({ ...args, user, targetUserId });
    };
  };
}

/**
 * Utility function to extract user ID from URL params
 */
export function extractUserIdFromParams(args: LoaderFunctionArgs | ActionFunctionArgs): string {
  return args.params.userId || "";
}

/**
 * Utility function to extract user ID from form data
 */
export function extractUserIdFromFormData(args: ActionFunctionArgs): string {
  // This would need to be implemented based on your form structure
  // For now, return empty string - implement as needed
  return "";
}

/**
 * Utility function to extract department from URL params
 */
export function extractDepartmentFromParams(args: LoaderFunctionArgs | ActionFunctionArgs): string | undefined {
  return args.params.department;
}

/**
 * Utility function to extract department from query params
 */
export function extractDepartmentFromQuery(args: LoaderFunctionArgs | ActionFunctionArgs): string | undefined {
  const url = new URL(args.request.url);
  return url.searchParams.get("department") || undefined;
}

// Common middleware combinations
export const superAdminOnly = withSuperAdmin;
export const adminOrSuperAdmin = withAdmin;
export const authenticated = withAuth;
export const userManagement = withUserManagement;
export const attendanceManagement = withAttendanceManagement;
export const reportsAccess = withReportsAccess;
export const settingsAccess = withSettingsAccess;