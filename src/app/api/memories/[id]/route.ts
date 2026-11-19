import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteMemory, updateMemory } from "@/lib/memories";
import { readAuthSession } from "@/lib/auth/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    await deleteMemory((await params).id, session.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The memory could not be deleted.";
    const status = message.includes("Only") || message.includes("preserved") ? 403 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  try {
    const memory = await updateMemory((await params).id, session.email, {
      title,
      date: String(form.get("date") ?? "").trim() || null,
      location: String(form.get("location") ?? "").trim().slice(0, 120) || null,
      body: String(form.get("body") ?? "").trim().slice(0, 3000),
    });
    return NextResponse.json({ memory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The memory could not be saved.";
    const status = message.includes("Only") || message.includes("preserved") ? 403 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
