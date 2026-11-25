/** Love letters, kept in Supabase (table love_letters, migration 0008) and reached only from the server. */

export type Letter = {
  id: string;
  authorEmail: string;
  authorName: string;
  recipient: string;
  closing: string;
  openAt: string | null;
  createdAt: string;
  /** Still sealed until `openAt`: the words are withheld, even from the writer. */
  sealed: boolean;
  body: string | null;
};

/** Calls a letter function in Supabase with the server-only read token. */
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = process.env.TRADER_READ_TOKEN;
  if (!url || !key || !token) throw new Error("Letters are not configured yet.");
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...args }),
  });
  if (res.status === 404) throw new Error("Letters are not set up in Supabase yet (run migration 0008).");
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try { msg = ((await res.json()) as { message?: string }).message ?? msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const listLetters = () => rpc<Letter[]>("letter_list", {});

export const sendLetter = (l: { authorEmail: string; authorName: string; recipient: string; body: string; closing: string; openAt: string | null }) =>
  rpc<Letter>("letter_send", {
    p_author_email: l.authorEmail, p_author_name: l.authorName, p_recipient: l.recipient,
    p_body: l.body, p_closing: l.closing, p_open_at: l.openAt,
  });

export const deleteLetter = (id: string, authorEmail: string) =>
  rpc<boolean>("letter_delete", { p_id: id, p_author_email: authorEmail });
