import { audit } from "@/lib/audit";
import { assertCsrf, clearSessionResponse, getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await assertCsrf(request);
  const session = await getSession();
  if (session) await audit({ userId: session.userId, action: "logout", request });
  return clearSessionResponse();
}
