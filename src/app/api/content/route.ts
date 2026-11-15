import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSharedContent, listSharedContent, type SharedContentType } from "@/lib/shared-content";
import { readAuthSession } from "@/lib/auth/session";

const types: SharedContentType[] = ["diary", "event", "idea", "capsule"];

async function session() {
  return readAuthSession((await cookies()).get("mumaa_session")?.value);
}

function validType(value: string | null): value is SharedContentType {
  return Boolean(value && types.includes(value as SharedContentType));
}

export async function GET(request: Request) {
  const current = await session();
  if (!current) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const type = new URL(request.url).searchParams.get("type");
  if (!validType(type)) return NextResponse.json({ error: "Unknown content type." }, { status: 400 });
  return NextResponse.json({ entries: await listSharedContent(type) });
}

export async function POST(request: Request) {
  const current = await session();
  if (!current) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const form = await request.formData();
  const type = String(form.get("type") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!validType(type) || !title) return NextResponse.json({ error: "A title and content type are required." }, { status: 400 });

  try {
    const entry = await createSharedContent({
      type,
      title: title.slice(0, 140),
      body: String(form.get("body") ?? "").trim().slice(0, 5000),
      date: String(form.get("date") ?? "").trim() || null,
      location: String(form.get("location") ?? "").trim() || null,
      status: String(form.get("status") ?? "").trim() || null,
      unlockAt: String(form.get("unlockAt") ?? "").trim() || null,
      authorEmail: current.email,
      authorName: current.name,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Could not save shared content", error);
    return NextResponse.json({ error: "This could not be saved right now." }, { status: 500 });
  }
}
