import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";
import { isFounderEmail } from "@/lib/auth/allowed-email";
import { buildLedger } from "@/lib/investors";
import {
  addInvestor, assignFlow, pullInvestors, removeInvestor, renameInvestor, splitFlow, startInvestors, unassignFlow,
} from "@/lib/investors-server";

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
  | { action: "assign"; flow: number; investor: number | null; ignore?: boolean }
  | { action: "rename"; investor: number; name: string }
  | { action: "remove"; investor: number }
  | { action: "unassign"; flow: number }
  | { action: "split"; flow: number; parts: { investor: number; amount: number }[] };

const bad = (error = "Bad request.") => NextResponse.json({ ok: false, error }, { status: 400 });
const cleanName = (v: unknown) => { const n = String(v ?? "").trim(); return n && n.length <= 60 ? n : null; };

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
    } else if (body.action === "rename") {
      const name = cleanName(body.name);
      if (!Number.isInteger(body.investor) || !name) return bad("Give a name (up to 60 letters).");
      await renameInvestor(body.investor, name);
    } else if (body.action === "remove") {
      if (!Number.isInteger(body.investor)) return bad();
      await removeInvestor(body.investor);
    } else if (body.action === "unassign") {
      if (!Number.isInteger(body.flow)) return bad();
      await unassignFlow(body.flow);
    } else if (body.action === "split") {
      const parts = Array.isArray(body.parts) ? body.parts : [];
      const ok = parts.length >= 2 && parts.length <= 20 && parts.every((x) => Number.isInteger(x?.investor) && Number.isFinite(x?.amount))
        && new Set(parts.map((x) => x.investor)).size === parts.length;
      if (!Number.isInteger(body.flow) || !ok) return bad("A split needs 2 or more different people, each with an amount.");
      await splitFlow(body.flow, parts.map((x) => ({ investor: x.investor, amount: Math.round(x.amount * 100) / 100 })));
    } else {
      return bad();
    }
    const pull = await pullInvestors();
    return NextResponse.json({ ok: true, ledger: buildLedger(pull) }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400, headers: noStore });
  }
}
