import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";
import { pullTrader } from "@/lib/trader";
import { TradingDashboard } from "@/components/trading-dashboard";

export const dynamic = "force-dynamic";

export default async function TradingPage() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  return <TradingDashboard initial={await pullTrader()} />;
}
