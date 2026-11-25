import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SharedModule } from "@/components/shared-module";
import { LoveLetters } from "@/components/love-letters";
import { listSharedContent } from "@/lib/shared-content";
import { listLetters, type Letter } from "@/lib/letters";
import { readAuthSession } from "@/lib/auth/session";

export default async function TimeCapsulesPage() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  const [entries, letters] = await Promise.all([
    listSharedContent("capsule", session.email),
    listLetters().then((l): { list: Letter[]; error: string | null } => ({ list: l, error: null }))
      .catch((e: unknown) => ({ list: [], error: e instanceof Error ? e.message : "Letters could not be loaded." })),
  ]);
  // Letters come first: the newest one waiting for you is the first thing on the page.
  return (
    <>
      <LoveLetters initial={letters.list} error={letters.error} currentEmail={session.email} currentName={session.name.trim().split(/\s+/)[0] || session.name} />
      <SharedModule type="capsule" entries={entries} currentEmail={session.email} />
    </>
  );
}
