import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  deleteSharedContent,
  updateSharedContent,
  type SharedContentType,
  type SharedEntryPatch,
} from "@/lib/shared-content";
import { readAuthSession } from "@/lib/auth/session";

const types = ["diary", "event", "idea", "capsule"];

function statusFor(message: string) {
  if (message.includes("Only") || message.includes("sealed")) return 403;
  if (message.includes("not found")) return 404;
  return 500;
}

async function authorise(params: Promise<{ type: string; id: string }>) {
  const current = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!current) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const { type, id } = await params;
  if (!types.includes(type)) return { error: NextResponse.json({ error: "Unknown content type." }, { status: 400 }) };
  return { current, type: type as SharedContentType, id };
}

function text(form: FormData, key: string, max: number) {
  if (!form.has(key)) return undefined;
  return String(form.get(key) ?? "").trim().slice(0, max);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const auth = await authorise(params);
  if ("error" in auth) return auth.error;
  const form = await request.formData();

  const patch: SharedEntryPatch = {};
  const title = text(form, "title", 140);
  if (title !== undefined) {
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    patch.title = title;
  }
  const body = text(form, "body", 5000);
  if (body !== undefined) patch.body = body;
  for (const key of ["date", "location", "status"] as const) {
    const value = text(form, key, 140);
    if (value !== undefined) patch[key] = value || null;
  }

  try {
    const entry = await updateSharedContent(auth.id, auth.type, auth.current.email, patch);
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This could not be saved.";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const auth = await authorise(params);
  if ("error" in auth) return auth.error;
  try {
    await deleteSharedContent(auth.id, auth.type, auth.current.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This could not be deleted.";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
