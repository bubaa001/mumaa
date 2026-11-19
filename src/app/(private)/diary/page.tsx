import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SharedModule } from "@/components/shared-module";
import { listSharedContent } from "@/lib/shared-content";
import { readAuthSession } from "@/lib/auth/session";

export default async function DiaryPage() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  return <SharedModule type="diary" entries={await listSharedContent("diary", session.email)} currentEmail={session.email} />;
}
