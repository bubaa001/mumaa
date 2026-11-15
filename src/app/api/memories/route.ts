import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createMemory, listMemories } from "@/lib/memories";
import { readAuthSession } from "@/lib/auth/session";

async function getSession() {
  return readAuthSession((await cookies()).get("mumaa_session")?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    return NextResponse.json({ memories: await listMemories() });
  } catch (error) {
    console.error("Could not list memories", error);
    return NextResponse.json({ error: "The memory archive could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const dateValue = String(formData.get("date") ?? "").trim();
  const locationValue = String(formData.get("location") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!title) return NextResponse.json({ error: "Give this memory a title first." }, { status: 400 });
  if (title.length > 120) return NextResponse.json({ error: "Keep the title under 120 characters." }, { status: 400 });
  if (files.length > 6) return NextResponse.json({ error: "Add up to six images per memory." }, { status: 400 });
  if (files.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
    return NextResponse.json({ error: "Images must be JPG, PNG, WEBP, or GIF files." }, { status: 400 });
  }
  if (files.some((file) => file.size > 8 * 1024 * 1024)) {
    return NextResponse.json({ error: "Each image must be smaller than 8 MB." }, { status: 400 });
  }

  try {
    const memory = await createMemory({
      title,
      date: dateValue || null,
      location: locationValue || null,
      body,
      files,
      authorEmail: session.email,
      authorName: session.name,
    });
    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    console.error("Could not create memory", error);
    return NextResponse.json({ error: "The memory could not be saved. Please try again." }, { status: 500 });
  }
}
