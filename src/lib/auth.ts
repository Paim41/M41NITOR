import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env, isProduction, requireEnv } from "./env";
import { prisma } from "./db";
import { randomToken, signValue, verifySignature } from "./crypto";

const sessionCookie = "tv_session";
const csrfCookie = "tv_csrf";

const sessionSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  exp: z.number(),
});

export type SessionUser = z.infer<typeof sessionSchema>;

function encodeSession(session: SessionUser) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

function decodeSession(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !verifySignature(payload, signature)) return null;
  try {
    const parsed = sessionSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession() {
  return decodeSession((await cookies()).get(sessionCookie)?.value);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session;
}

export function sessionExpiresAt() {
  return Date.now() + 1000 * 60 * 60 * 8;
}

export function createSessionResponse(user: SessionUser) {
  const response = NextResponse.json({ user: { id: user.userId, email: user.email } });
  response.cookies.set(sessionCookie, encodeSession(user), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export function clearSessionResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

export async function ensureAdminUser(email: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, role: "admin" },
  });
}

export async function verifyAdminCredentials(email: string, password: string) {
  const expectedEmail = requireEnv("ADMIN_EMAIL").toLowerCase();
  const expectedHash = requireEnv("ADMIN_PASSWORD_HASH");
  if (email.toLowerCase() !== expectedEmail) return null;
  const ok = await bcrypt.compare(password, expectedHash);
  if (!ok) return null;
  return ensureAdminUser(expectedEmail, expectedHash);
}

export function authConfigured() {
  return Boolean(env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH && env.SESSION_SECRET);
}

export function issueCsrf() {
  const token = randomToken(24);
  const response = NextResponse.json({ csrfToken: token });
  response.cookies.set(csrfCookie, `${token}.${signValue(token)}`, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function assertCsrf(request: Request) {
  const header = request.headers.get("x-csrf-token");
  const stored = (await cookies()).get(csrfCookie)?.value;
  if (!header || !stored) throw new Response("Invalid CSRF token", { status: 403 });
  const [token, signature] = stored.split(".");
  if (header !== token || !signature || !verifySignature(token, signature)) {
    throw new Response("Invalid CSRF token", { status: 403 });
  }
}
