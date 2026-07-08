import { NextResponse } from "next/server";
import { authConfigured, getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    configured: authConfigured(),
    user: session ? { id: session.userId, email: session.email } : null,
  });
}
