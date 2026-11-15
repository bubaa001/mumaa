import { del, get, list, put } from "@vercel/blob";

export type SharedContentType = "diary" | "event" | "idea" | "capsule";

export type SharedEntry = {
  id: string;
  type: SharedContentType;
  title: string;
  body: string;
  date: string | null;
  location: string | null;
  status: string | null;
  unlockAt: string | null;
  authorEmail: string;
  authorName: string;
  createdAt: string;
};

const prefix = "mumaa-content/";

function recordPath(type: SharedContentType, id: string) {
  return `${prefix}${type}/${id}.json`;
}

function configured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readRecord(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text()) as SharedEntry;
}

export async function listSharedContent(type: SharedContentType) {
  if (!configured()) return [];
  const result = await list({ prefix: `${prefix}${type}/` });
  const entries = await Promise.all(result.blobs.map((blob) => readRecord(blob.pathname)));
  return entries
    .filter((entry): entry is SharedEntry => Boolean(entry))
    .filter((entry) => type !== "capsule" || !entry.unlockAt || Date.parse(entry.unlockAt) <= Date.now())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function createSharedContent(input: Omit<SharedEntry, "id" | "createdAt">) {
  if (!configured()) throw new Error("Shared content storage is not configured.");
  const entry: SharedEntry = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await put(recordPath(entry.type, entry.id), JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return entry;
}

export async function deleteSharedContent(id: string, type: SharedContentType, authorEmail: string) {
  if (!configured()) throw new Error("Shared content storage is not configured.");
  const entry = await readRecord(recordPath(type, id));
  if (!entry) throw new Error("Entry not found.");
  if (entry.authorEmail !== authorEmail) throw new Error("Only the person who added this entry can delete it.");
  await del(recordPath(type, id));
}
