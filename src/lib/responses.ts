import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function redactTelegram(value: string | null | undefined) {
  if (!value) return "not configured";
  if (value.length <= 6) return "configured";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
