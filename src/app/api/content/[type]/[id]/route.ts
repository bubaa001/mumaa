import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSharedContent, type SharedContentType } from "@/lib/shared-content";
import { readAuthSession } from "@/lib/auth/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const current = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!current) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { type, id } = await params;
  if (!["diary", "event", "idea", "capsule"].includes(type)) return NextResponse.json({ error: "Unknown content type." }, { status: 400 });
  try {
    await deleteSharedContent(id, type as SharedContentType, current.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This could not be deleted.";
    return NextResponse.json({ error: message }, { status: message.includes("Only") ? 403 : 404 });
  }
}
