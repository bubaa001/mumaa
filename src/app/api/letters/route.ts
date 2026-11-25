import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";
import { deleteLetter, listLetters, sendLetter } from "@/lib/letters";

async function session() {
  return readAuthSession((await cookies()).get("mumaa_session")?.value);
}

const fail = (error: unknown, fallback: string) =>
  NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });

export async function GET() {
  if (!(await session())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json({ letters: await listLetters() });
  } catch (error) {
    return fail(error, "Letters could not be loaded.");
  }
}

export async function POST(request: Request) {
  const current = await session();
  if (!current) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const recipient = String(input.recipient ?? "").trim().slice(0, 80);
  const body = String(input.body ?? "").trim().slice(0, 8000);
  const closing = String(input.closing ?? "").trim().slice(0, 80);
  const openText = String(input.openAt ?? "").trim();
  const openTime = openText ? Date.parse(openText) : NaN;
  if (!recipient || !body) return NextResponse.json({ error: "A letter needs who it’s for and a few words." }, { status: 400 });
  try {
    const letter = await sendLetter({
      authorEmail: current.email,
      authorName: (current.name.trim().split(/\s+/)[0] || current.email.split("@")[0]).slice(0, 80),
      recipient,
      body,
      closing,
      openAt: Number.isNaN(openTime) ? null : new Date(openTime).toISOString(),
    });
    return NextResponse.json({ letter }, { status: 201 });
  } catch (error) {
    console.error("Could not send letter", error);
    return fail(error, "The letter could not be sent right now.");
  }
}

export async function DELETE(request: Request) {
  const current = await session();
  if (!current) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown letter." }, { status: 400 });
  try {
    const removed = await deleteLetter(id, current.email);
    if (!removed) return NextResponse.json({ error: "Only the person who wrote a letter can take it back." }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error, "The letter could not be removed.");
  }
}
