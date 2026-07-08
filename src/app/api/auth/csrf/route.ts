import { issueCsrf } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return issueCsrf();
}
