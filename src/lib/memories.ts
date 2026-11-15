import { get, list, put, del } from "@vercel/blob";

export type MemoryImage = {
  filename: string;
  alt: string;
};

export type Memory = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  date: string | null;
  location: string | null;
  images: MemoryImage[];
  cover_image_url: string | null;
  route: string;
  created_at: string;
  author_email: string | null;
  author_name: string | null;
  is_published: boolean;
  is_legacy?: boolean;
};

const memoryPrefix = "mumaa-memories/";

const graduationMemory: Memory = {
  id: "graduation-2026",
  slug: "graduation-2026",
  title: "A day worth remembering",
  excerpt:
    "A graduation story for Anna Joseph. A little celebration, a letter, a flight, and a keepsake made with love.",
  body: "",
  date: "2026-01-01",
  location: null,
  images: [],
  cover_image_url: null,
  route: "/memories/graduation-2026/",
  created_at: "2026-01-01T00:00:00.000Z",
  author_email: null,
  author_name: null,
  is_published: true,
  is_legacy: true,
};

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function recordPath(id: string) {
  return `${memoryPrefix}${id}/memory.json`;
}

function imagePath(id: string, index: number, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${memoryPrefix}${id}/${String(index + 1).padStart(2, "0")}.${extension}`;
}

async function readRecord(pathname: string): Promise<Memory | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;

  const text = await new Response(result.stream).text();
  return JSON.parse(text) as Memory;
}

export async function listMemories(): Promise<Memory[]> {
  if (!hasBlobToken()) return [graduationMemory];

  const result = await list({ prefix: memoryPrefix });
  const records = await Promise.all(
    result.blobs
      .filter((blob) => blob.pathname.endsWith("/memory.json"))
      .map((blob) => readRecord(blob.pathname)),
  );

  return [graduationMemory, ...records.filter((memory): memory is Memory => Boolean(memory))]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function getMemory(id: string) {
  if (id === graduationMemory.id) return graduationMemory;
  if (!hasBlobToken()) return null;
  return readRecord(recordPath(id));
}

export async function createMemory({
  title,
  date,
  location,
  body,
  files,
  authorEmail,
  authorName,
}: {
  title: string;
  date: string | null;
  location: string | null;
  body: string;
  files: File[];
  authorEmail: string;
  authorName: string;
}) {
  if (!hasBlobToken()) {
    throw new Error("Memory storage is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.");
  }

  const id = crypto.randomUUID();
  const images: MemoryImage[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const pathname = imagePath(id, index, file);
      await put(pathname, file, {
        access: "private",
        addRandomSuffix: false,
        contentType: file.type,
      });
      images.push({
        filename: pathname.split("/").pop()!,
        alt: title,
      });
    }

    const now = new Date().toISOString();
    const memory: Memory = {
      id,
      slug: id,
      title,
      excerpt: body.slice(0, 180),
      body,
      date,
      location,
      images,
      cover_image_url: images[0] ? `/api/memories/media/${id}/${images[0].filename}` : null,
      route: `/memories/${id}`,
      created_at: now,
      author_email: authorEmail,
      author_name: authorName,
      is_published: true,
    };

    await put(recordPath(id), JSON.stringify(memory), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    return memory;
  } catch (error) {
    await Promise.all(
      images.map((image) =>
        del(`${memoryPrefix}${id}/${image.filename}`).catch(() => undefined),
      ),
    );
    throw error;
  }
}

export async function deleteMemory(id: string, authorEmail: string) {
  const memory = await getMemory(id);
  if (!memory) throw new Error("Memory not found.");
  if (memory.is_legacy) throw new Error("The graduation chapter is preserved and cannot be deleted.");
  if (memory.author_email !== authorEmail) throw new Error("Only the person who added this memory can delete it.");

  await Promise.all([
    del(recordPath(id)),
    ...memory.images.map((image) => del(`${memoryPrefix}${id}/${image.filename}`)),
  ]);
}
