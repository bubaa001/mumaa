import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MemoriesArchive } from "@/components/memories-archive";
import { listMemories } from "@/lib/memories";
import { readAuthSession } from "@/lib/auth/session";

export default async function MemoriesPage() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  return <MemoriesArchive memories={await listMemories()} />;
}
