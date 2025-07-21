import { createCookieSessionStorage, redirect } from "react-router";
import { getUserFromToken } from "./auth.server";
import type { User } from "@prisma/client";

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

export async function requireAdmin(request: Request): Promise<User> {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") {
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