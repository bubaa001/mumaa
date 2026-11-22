import { buildRecord, type PublicRecord, type RawRecord } from "@/lib/performance";

export type RecordResult =
  | { ok: true; record: PublicRecord | null; verified: { url: string; label: string } | null }
  | { ok: false; error: string };

/** Independent verification link (e.g. Myfxbook), set in Vercel as VERIFIED_RECORD_URL once it exists. */
export function verifiedLink(): { url: string; label: string } | null {
  const url = process.env.VERIFIED_RECORD_URL?.trim();
  if (!url || !/^https:\/\//.test(url)) return null;
  return { url, label: process.env.VERIFIED_RECORD_LABEL?.trim() || "Independent verification" };
}

/** Public track record, cached for 5 minutes so a busy public page can't hammer Supabase. */
export async function pullPublicRecord(): Promise<RecordResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = process.env.TRADER_READ_TOKEN;
  if (!url || !key || !token) return { ok: false, error: "The track record is not configured yet." };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/trader_public_record`, {
      method: "POST",
      next: { revalidate: 300 },
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    if (res.status === 404) return { ok: false, error: "The track record is not set up yet (migration 0006)." };
    if (!res.ok) return { ok: false, error: `Could not read the track record (${res.status}).` };
    return { ok: true, record: buildRecord((await res.json()) as RawRecord), verified: verifiedLink() };
  } catch {
    return { ok: false, error: "Could not reach the database." };
  }
}
