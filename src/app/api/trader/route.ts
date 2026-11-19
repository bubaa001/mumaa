import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";
import { pullTrader } from "@/lib/trader";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const result = await pullTrader();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
