import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db.server";
import { userCache, getCacheKey } from "./cache.server";
import type { User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function authenticateUser(username: string, password: string): Promise<{ user: User; token: string } | null> {
  // Find user with their password only - optimize by not loading roles/permissions here
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      password: {
        select: {
          hash: true,
        },
      },
      roles: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user || !user.isActive || !user.password) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.password.hash);
  if (!isValidPassword) {
    return null;
  }

  const token = generateToken(user.id);
  
  // Return user without password for security - roles are included for primary role determination
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword as User, token };
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  // Check cache first
  const cacheKey = getCacheKey.user(payload.userId);
  const cachedUser = userCache.get<User>(cacheKey);
  if (cachedUser) {
    return cachedUser;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      name: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              id: true,
              action: true,
              entity: true,
              access: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  // Cache the user for 2 minutes (shorter TTL for auth data)
  userCache.set(cacheKey, user as User, 2 * 60 * 1000);

  return user as User;
}

export async function createUser(data: {
  username: string;
  password: string;
  name: string;
  department?: string;
  roleIds: string[];
}): Promise<User> {
  const hashedPassword = await hashPassword(data.password);
  
  const user = await prisma.user.create({
    data: {
      username: data.username,
      name: data.name,
      department: data.department,
      password: {
        create: { hash: hashedPassword }
      },
      roles: {
        connect: data.roleIds.map(id => ({ id }))
      },
      isActive: true,
    },
    include: {
      roles: {
        include: {
          permissions: true,
        },
      },
    },
  });

  return user;
}

export async function updateUser(userId: string, data: {
  username?: string;
  name?: string;
  department?: string;
  password?: string;
  roleIds?: string[];
  isActive?: boolean;
}): Promise<User> {
  const updateData: {
    username?: string;
    name?: string;
    department?: string | null;
    isActive?: boolean;
    roles?: {
      set: never[];
      connect: { id: string }[];
    };
  } = {};
  
  if (data.username !== undefined) updateData.username = data.username;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  if (data.roleIds) {
    updateData.roles = {
      set: [], // Clear existing roles
      connect: data.roleIds.map(id => ({ id }))
    };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: {
      roles: {
        include: {
          permissions: true,
        },
      },
    },
  });

  // Update password if provided
  if (data.password) {
    const hashedPassword = await hashPassword(data.password);
    await prisma.password.upsert({
      where: { userId },
      update: { hash: hashedPassword },
      create: {
        userId,
        hash: hashedPassword
      }
    });
  }

  // Clear cache for this user since data has changed
  userCache.delete(getCacheKey.user(userId));
  userCache.delete(getCacheKey.userWithPermissions(userId));

  return user;
}

export async function deleteUser(userId: string): Promise<void> {
  // Check if user exists and get their roles
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true }
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Prevent deletion of superadmin users
  const isSuperadmin = user.roles.some(role => role.name === "SUPERADMIN");
  if (isSuperadmin) {
    throw new Error("Cannot delete superadmin users");
  }

  // Delete user (password will be deleted automatically due to cascade)
  await prisma.user.delete({
    where: { id: userId }
  });

  // Clear cache for this user
  userCache.delete(getCacheKey.user(userId));
  userCache.delete(getCacheKey.userWithPermissions(userId));
}


/**
 * Get all available roles
 */
export async function getAllRoles() {
  return prisma.role.findMany({
    include: {
      permissions: true,
    },
    orderBy: { name: "asc" }
  });
}

// Re-export client-safe functions for server-side usage
export { getUserPrimaryRole, userHasRole } from "./auth";

/**
 * Get role by name
 */
export async function getRoleByName(name: string) {
  return prisma.role.findUnique({
    where: { name },
    include: {
      permissions: true,
    },
  });
}