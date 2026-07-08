import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { destinationFor, destinationLabels, upsertDestination } from "@/lib/destination";
import { jsonError, redactTelegram } from "@/lib/responses";
import { categories } from "@/lib/types";
import { testTelegramDestination } from "@/lib/telegram";

export const runtime = "nodejs";

const updateSchema = z.object({
  destinations: z.array(z.object({
    category: z.enum(categories),
    chatId: z.string().min(1),
    label: z.string().max(80).optional(),
  })),
});

export async function GET() {
  await requireAdmin();
  const destinations = await Promise.all(categories.map(async (category) => {
    const destination = await destinationFor(category);
    return {
      category,
      label: destination.label,
      source: destination.source,
      configured: Boolean(destination.chatId),
      chatIdPreview: redactTelegram(destination.chatId),
    };
  }));
  return NextResponse.json({ destinations, labels: destinationLabels });
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const body = updateSchema.parse(await request.json());
    await Promise.all(body.destinations.map((destination) => upsertDestination(destination.category, destination.chatId, destination.label)));
    await audit({ userId: session.userId, action: "telegram_configuration_update", request });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Telegram settings update failed", 400);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await assertCsrf(request);
    const results = await Promise.all(categories.map(async (category) => {
      const destination = await destinationFor(category);
      if (!destination.chatId) return { category, label: destination.label, ok: false, error: "Destination is not configured" };
      return { category, label: destination.label, ...(await testTelegramDestination(destination.chatId)) };
    }));
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Telegram health check failed", 400);
  }
}
