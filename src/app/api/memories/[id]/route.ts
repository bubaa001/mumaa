import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteMemory } from "@/lib/memories";
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
