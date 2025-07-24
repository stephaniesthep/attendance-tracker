import type { User } from "@prisma/client";

/**
 * Get user's primary role (highest priority role)
 * This is a client-safe utility function
 */
export function getUserPrimaryRole(user: { roles: { name: string }[] }): string {
  if (!user.roles || user.roles.length === 0) return "WORKER";
  
  // Role priority: SUPERADMIN > ADMIN > WORKER
  const roleOrder = { SUPERADMIN: 0, ADMIN: 1, WORKER: 2 };
  
  const sortedRoles = user.roles.sort((a, b) => {
    const aOrder = roleOrder[a.name as keyof typeof roleOrder] ?? 3;
    const bOrder = roleOrder[b.name as keyof typeof roleOrder] ?? 3;
    return aOrder - bOrder;
  });
  
  return sortedRoles[0]?.name || "WORKER";
}

/**
 * Check if user has a specific role
 * This is a client-safe utility function
 */
export function userHasRole(user: { roles: { name: string }[] }, roleName: string): boolean {
  return user.roles?.some(role => role.name === roleName) || false;
}