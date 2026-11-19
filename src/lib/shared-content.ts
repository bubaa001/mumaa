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
  updatedAt?: string;
  /** Set on capsules whose opening time has not arrived; their contents are withheld. */
  sealed?: boolean;
};

export type SharedEntryPatch = Partial<Pick<SharedEntry, "title" | "body" | "date" | "location" | "status" | "unlockAt">>;

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

async function writeRecord(entry: SharedEntry) {
  await put(recordPath(entry.type, entry.id), JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export function isSealed(entry: Pick<SharedEntry, "type" | "unlockAt">, now = Date.now()) {
  return entry.type === "capsule" && Boolean(entry.unlockAt) && Date.parse(entry.unlockAt!) > now;
}

/** Sealed capsules stay listed so they can be counted down, but their words stay hidden. */
function present(entry: SharedEntry, viewerEmail?: string): SharedEntry {
  if (!isSealed(entry)) return entry;
  return {
    ...entry,
    title: entry.authorEmail === viewerEmail ? entry.title : "A sealed capsule",
    body: "",
    sealed: true,
  };
}

/** Today's date as YYYY-MM-DD, used to tell upcoming events from past ones. */
export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function sortEntries(type: SharedContentType, entries: SharedEntry[]) {
  const newest = (a: SharedEntry, b: SharedEntry) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (type === "event") {
    const today = todayKey();
    const upcoming = entries.filter((entry) => entry.date && entry.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
    const undated = entries.filter((entry) => !entry.date).sort(newest);
    const past = entries.filter((entry) => entry.date && entry.date < today).sort((a, b) => b.date!.localeCompare(a.date!));
    return [...upcoming, ...undated, ...past];
  }
  if (type === "capsule") {
    const open = entries.filter((entry) => !entry.sealed).sort(newest);
    const sealed = entries.filter((entry) => entry.sealed).sort((a, b) => Date.parse(a.unlockAt!) - Date.parse(b.unlockAt!));
    return [...open, ...sealed];
  }
  return entries.sort(newest);
}

export async function listSharedContent(type: SharedContentType, viewerEmail?: string) {
  if (!configured()) return [];
  const result = await list({ prefix: `${prefix}${type}/` });
  const entries = await Promise.all(result.blobs.map((blob) => readRecord(blob.pathname)));
  return sortEntries(
    type,
    entries.filter((entry): entry is SharedEntry => Boolean(entry)).map((entry) => present(entry, viewerEmail)),
  );
}

export async function createSharedContent(input: Omit<SharedEntry, "id" | "createdAt">) {
  if (!configured()) throw new Error("Shared content storage is not configured.");
  const entry: SharedEntry = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await writeRecord(entry);
  return entry;
}

export async function updateSharedContent(id: string, type: SharedContentType, authorEmail: string, patch: SharedEntryPatch) {
  if (!configured()) throw new Error("Shared content storage is not configured.");
  const entry = await readRecord(recordPath(type, id));
  if (!entry) throw new Error("Entry not found.");
  if (entry.authorEmail !== authorEmail) throw new Error("Only the person who added this entry can edit it.");
  if (isSealed(entry)) throw new Error("A sealed capsule can’t be edited until it opens.");
  const updated: SharedEntry = { ...entry, ...patch, updatedAt: new Date().toISOString() };
  await writeRecord(updated);
  return present(updated, authorEmail);
}

export async function deleteSharedContent(id: string, type: SharedContentType, authorEmail: string) {
  if (!configured()) throw new Error("Shared content storage is not configured.");
  const entry = await readRecord(recordPath(type, id));
  if (!entry) throw new Error("Entry not found.");
  if (entry.authorEmail !== authorEmail) throw new Error("Only the person who added this entry can delete it.");
  await del(recordPath(type, id));
}
