import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, MapPin, User } from "lucide-react";
import { MemoryDeleteButton } from "@/components/memory-delete-button";
import { MemoryEditButton } from "@/components/memory-edit-button";
import { Reveal } from "@/components/motion";
import { PhotoGallery } from "@/components/photo-gallery";
import { getMemory } from "@/lib/memories";
import { formatMemoryDate } from "@/lib/format";
import { readAuthSession } from "@/lib/auth/session";

export default async function MemoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");
  const memory = await getMemory((await params).id);
  if (!memory) notFound();

  return (
    <article>
      <Link className="detail-back" href="/memories">
        <ArrowLeft aria-hidden="true" /> The archive
      </Link>

      <Reveal as="header" className="detail-head">
        <span className="eyebrow">{memory.is_legacy ? "Chapter 01 · Anna’s graduation" : "From our archive"}</span>
        <h1 className="display">{memory.title}</h1>
        <div className="detail-meta">
          {memory.date && <span><CalendarDays aria-hidden="true" /> {formatMemoryDate(memory.date, "long")}</span>}
          {memory.location && <span><MapPin aria-hidden="true" /> {memory.location}</span>}
          {!memory.is_legacy && memory.author_name && <span><User aria-hidden="true" /> Added by {memory.author_name}</span>}
        </div>
      </Reveal>

      {memory.is_legacy ? (
        <Reveal className="legacy-card" delay={0.1}>
          <p>{memory.excerpt}</p>
          <a className="btn btn-light btn-lg" href="/memories/graduation-2026/">
            Open the graduation experience <ArrowUpRight aria-hidden="true" />
          </a>
        </Reveal>
      ) : (
        <>
          {memory.images.length > 0 && (
            <PhotoGallery
              caption={[memory.title, memory.date && formatMemoryDate(memory.date, "long"), memory.location].filter(Boolean).join(" · ")}
              photos={memory.images.map((image) => ({ src: `/api/memories/media/${memory.id}/${image.filename}`, alt: image.alt }))}
            />
          )}
          {memory.body && <Reveal><p className="detail-body">{memory.body}</p></Reveal>}
          {memory.author_email === session.email && (
            <div className="detail-actions">
              <div className="detail-owner-actions">
                <MemoryEditButton
                  memory={{ id: memory.id, title: memory.title, date: memory.date, location: memory.location, body: memory.body }}
                />
                <MemoryDeleteButton memoryId={memory.id} />
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}
