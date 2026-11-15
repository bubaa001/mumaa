import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; filename: string }> },
) {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) return new NextResponse("Authentication required.", { status: 401 });

  const { id, filename } = await params;
  if (filename.includes("/") || id.includes("/")) return new NextResponse("Invalid media path.", { status: 400 });

  const result = await get(`mumaa-memories/${id}/${filename}`, { access: "private" });
  if (!result) return new NextResponse("Media not found.", { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": result.blob.contentType || "application/octet-stream",
    },
  });
}
