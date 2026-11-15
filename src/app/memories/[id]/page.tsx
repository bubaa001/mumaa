import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { MummaaShell } from "@/components/mumaa-shell";
import { MemoryDeleteButton } from "@/components/memory-delete-button";
import { getMemory } from "@/lib/memories";
import { readAuthSession } from "@/lib/auth/session";

export default async function MemoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  const memory = await getMemory((await params).id);
  if (!memory) notFound();

  return (
    <MummaaShell>
      <article className="memory-detail">
        <Link className="memory-back-link" href="/memories">← Back to the archive</Link>
        <header className="memory-detail-heading">
          <p className="memory-eyebrow">{memory.is_legacy ? "Chapter 01 · Anna's graduation" : "From our archive"}</p>
          <h1>{memory.title}</h1>
          <div className="memory-detail-meta">
            {memory.date && <span>{new Date(`${memory.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>}
            {memory.location && <span>{memory.location}</span>}
            {!memory.is_legacy && memory.author_name && <span>Added by {memory.author_name}</span>}
          </div>
        </header>
        {memory.is_legacy ? (
          <Link className="memory-legacy-link" href="/memories/graduation-2026/">Open the original graduation experience <span aria-hidden="true">↗</span></Link>
        ) : (
          <>
            {memory.images.length > 0 && (
              <div className="memory-detail-gallery">
                {memory.images.map((image) => <img key={image.filename} src={`/api/memories/media/${memory.id}/${image.filename}`} alt={image.alt} />)}
              </div>
            )}
            {memory.body && <p className="memory-detail-body">{memory.body}</p>}
            <div className="memory-detail-actions">
              {memory.author_email === session.email && <MemoryDeleteButton memoryId={memory.id} />}
            </div>
          </>
        )}
      </article>
    </MummaaShell>
  );
}
