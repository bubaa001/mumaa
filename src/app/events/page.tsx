import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MummaaShell } from "@/components/mumaa-shell";
import { SharedModule } from "@/components/shared-module";
import { listSharedContent } from "@/lib/shared-content";
import { readAuthSession } from "@/lib/auth/session";

export default async function EventsPage() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  return <MummaaShell><SharedModule type="event" entries={await listSharedContent("event")} currentEmail={session.email} /></MummaaShell>;
}
