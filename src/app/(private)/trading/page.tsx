import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";
import { isFounderEmail } from "@/lib/auth/allowed-email";
import { pullTrader } from "@/lib/trader";
import { TradingDashboard } from "@/components/trading-dashboard";
import { isView } from "@/lib/trader-view";

export const dynamic = "force-dynamic";

type Search = { view?: string; agent?: string; market?: string };

export default async function TradingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  const q = await searchParams;
  const founder = isFounderEmail(session.email);
  const view = isView(q.view) && (founder || q.view !== "investors") ? q.view : "overview";
  const nav = { view, agent: view === "agents" ? q.agent ?? null : null, market: view === "agents" ? q.market ?? null : null };
  return <TradingDashboard initial={await pullTrader()} nav={nav} founder={founder} />;
}
