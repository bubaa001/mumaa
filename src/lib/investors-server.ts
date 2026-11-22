import type { InvestorPull } from "@/lib/investors";

/** Calls an investor RPC in Supabase with the server-only trader read token. */
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = process.env.TRADER_READ_TOKEN;
  if (!url || !key || !token) throw new Error("The trading page is not configured yet (TRADER_READ_TOKEN missing).");
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...args }),
  });
  if (res.status === 404) throw new Error("Investor tracking is not set up in Supabase yet (run migration 0005).");
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try { msg = ((await res.json()) as { message?: string }).message ?? msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const pullInvestors = () => rpc<InvestorPull>("investor_pull", {});
export const startInvestors = (founder: string) => rpc<null>("investor_start", { p_founder: founder });
export const addInvestor = (name: string) => rpc<number>("investor_add", { p_name: name });
export const assignFlow = (flow: number, investor: number | null, ignore: boolean) =>
  rpc<null>("investor_assign", { p_flow: flow, p_investor: investor, p_ignore: ignore });
export const renameInvestor = (id: number, name: string) => rpc<null>("investor_rename", { p_id: id, p_name: name });
export const removeInvestor = (id: number) => rpc<null>("investor_remove", { p_id: id });
export const unassignFlow = (flow: number) => rpc<null>("investor_unassign", { p_flow: flow });
export const splitFlow = (flow: number, parts: { investor: number; amount: number }[]) =>
  rpc<null>("investor_split", { p_flow: flow, p_parts: parts });
