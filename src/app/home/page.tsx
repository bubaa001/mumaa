import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FadeIn, MummaaShell } from "@/components/mumaa-shell";
import { listMemories, type Memory } from "@/lib/memories";
import { readAuthSession } from "@/lib/auth/session";

export default async function PrivateHomePage() {
  const token = (await cookies()).get("mumaa_session")?.value;
  const session = await readAuthSession(token);
  if (!session) redirect("/login");

  const memories = await listMemories();
  const currentDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return <PrivateHomeContent currentDate={currentDate} displayName={session.name} memories={memories} />;
}

function PrivateHomeContent({
  currentDate,
  displayName,
  memories,
}: {
  currentDate: string;
  displayName: string;
  memories: Memory[];
}) {
  const featuredMemory = memories[0];

  return (
    <MummaaShell>
      <FadeIn>
        <div className="private-home home-blueprint">
          <section className="home-hero" aria-labelledby="home-title">
            <div className="home-hero-copy">
              <p className="home-kicker">Our world · est. 2026</p>
              <h1 id="home-title">
                Two lives.
                <br />
                <em>One little universe.</em>
              </h1>
              <p className="home-intro">
                A place for everything we&apos;ve lived, everything we&apos;re keeping,
                and everything still waiting to happen.
              </p>
              <div className="home-hero-meta">
                <span>Welcome, {displayName === "MUMAA" ? "Joshua & Anna" : displayName}</span>
                <span>{currentDate}</span>
              </div>
              <a className="home-primary-link" href="/memories">
                Explore our memories <span aria-hidden="true">↗</span>
              </a>
            </div>
            <figure className="home-hero-photo">
              <img src="/images/anna/anna-dearest.jpg" alt="Anna smiling in a light sweater and glasses" />
              <figcaption>Every story begins somewhere.</figcaption>
            </figure>
          </section>

          <section className="home-story-section" aria-labelledby="story-title">
            <div className="home-section-heading">
              <p className="home-kicker">Our story, so far</p>
              <h2 id="story-title">Little moments. A lifetime of meaning.</h2>
              <p>Some of our favourite things are the moments we never planned.</p>
            </div>
            <div className="home-memory-layout">
              <MemoryFeature memory={featuredMemory} />
              <div className="home-memory-stack">
                <MemoryEmptyState />
                <a className="home-chapter-link" href="/memories/graduation-2026/">
                  <span>
                    <small>Chapter 01</small>
                    Anna&apos;s graduation
                  </span>
                  <strong aria-hidden="true">↗</strong>
                </a>
              </div>
            </div>
            <a className="home-section-link" href="/memories">View the archive <span aria-hidden="true">↗</span></a>
          </section>

          <section className="home-diary-section" aria-labelledby="diary-title">
            <div className="home-section-heading">
              <p className="home-kicker">Between the lines</p>
              <h2 id="diary-title">Things we don&apos;t want to forget saying.</h2>
            </div>
            <div className="home-diary-content">
              <div>
                <p className="home-empty-label">The first entry is still unwritten.</p>
                <p className="home-empty-copy">
                  Leave something here for the version of you that comes back later.
                </p>
              </div>
              <div className="home-action-row">
                <a href="/diary">Read entry <span aria-hidden="true">↗</span></a>
                <a href="/diary">Write something <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </section>

          <section className="home-events-section" aria-labelledby="events-title">
            <div className="home-section-heading">
              <p className="home-kicker">The days ahead</p>
              <h2 id="events-title">And then, there&apos;s everything still to come.</h2>
            </div>
            <div className="home-empty-timeline">
              <span className="home-timeline-line" aria-hidden="true" />
              <div>
                <p className="home-empty-label">No moments on the calendar yet.</p>
                <p className="home-empty-copy">Plan the first one together.</p>
              </div>
            </div>
            <a className="home-section-link" href="/events">Add a moment to our calendar <span aria-hidden="true">↗</span></a>
          </section>

          <section className="home-ideas-section" aria-labelledby="ideas-title">
            <div className="home-section-heading">
              <p className="home-kicker">Little plans, big possibilities</p>
              <h2 id="ideas-title">Things we might do.</h2>
            </div>
            <div className="home-ideas-layout">
              <p className="home-empty-copy">The idea board is open for its first possibility.</p>
              <a className="home-section-link" href="/ideas">Create an idea <span aria-hidden="true">↗</span></a>
            </div>
          </section>

          <footer className="home-closing">
            <h2>Whatever comes next,<br /><em>we&apos;ll have a place for it.</em></h2>
            <div>
              <p>MUMAA - A PRIVATE WORLD FOR TWO.</p>
              <span>2026</span>
            </div>
          </footer>
        </div>
      </FadeIn>
    </MummaaShell>
  );
}

function MemoryFeature({ memory }: { memory: Memory | undefined }) {
  return (
    <article className="home-memory-feature">
      <div className="home-memory-visual">
        <img src="/images/anna/anna-soft.jpg" alt="Anna in a soft indoor portrait" />
      </div>
      <div className="home-memory-caption">
        <span>{memory?.created_at ? new Date(memory.created_at).getFullYear() : "The archive"}</span>
        <div>
          <h3>{memory?.title ?? "The first memory is waiting."}</h3>
          <p>{memory?.excerpt ?? "Add the first photograph and give this chapter somewhere to begin."}</p>
        </div>
        <a href={memory?.route ?? "/memories"}>Open memory <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  );
}

function MemoryEmptyState() {
  return (
    <div className="home-memory-empty">
      <span aria-hidden="true">+</span>
      <p>Add a shared photograph to begin the next chapter.</p>
      <a href="/memories">Open memories <span aria-hidden="true">↗</span></a>
    </div>
  );
}
