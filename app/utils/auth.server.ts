import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db.server";
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

export async function authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    return null;
  }

  const token = generateToken(user.id);
  return { user, token };
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: payload.userId },
  });
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
}): Promise<User> {
  const hashedPassword = await hashPassword(data.password);
  
  return prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
      role: data.role || "user",
    },
  });
}