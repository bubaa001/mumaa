import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";
import { isFounderEmail } from "@/lib/auth/allowed-email";
import { buildLedger } from "@/lib/investors";
import { addInvestor, assignFlow, pullInvestors, startInvestors } from "@/lib/investors-server";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Founder only: investor money is private to the account owner. */
async function founder() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  return session && isFounderEmail(session.email) ? session : null;
}

export async function GET() {
  if (!(await founder())) return NextResponse.json({ error: "Not available." }, { status: 404 });
  try {
    const pull = await pullInvestors();
    return NextResponse.json({ ok: true, ledger: buildLedger(pull) }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { headers: noStore });
  }
}

type Body =
  | { action: "start"; name: string }
  | { action: "add"; name: string }
  | { action: "assign"; flow: number; investor: number | null; ignore?: boolean };

export async function POST(request: NextRequest) {
  const me = await founder();
  if (!me) return NextResponse.json({ error: "Not available." }, { status: 404 });
  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  try {
    if (body.action === "start") {
      await startInvestors(String(body.name || me.name || "Founder").slice(0, 60));
    } else if (body.action === "add") {
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 60) return NextResponse.json({ error: "Give a name (up to 60 letters)." }, { status: 400 });
      await addInvestor(name);
    } else if (body.action === "assign") {
      if (!Number.isInteger(body.flow)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
      await assignFlow(body.flow, body.ignore ? null : body.investor, Boolean(body.ignore));
    } else {
      return NextResponse.json({ error: "Bad request." }, { status: 400 });
    }
    const pull = await pullInvestors();
    return NextResponse.json({ ok: true, ledger: buildLedger(pull) }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400, headers: noStore });
  }
}
