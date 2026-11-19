import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, GraduationCap, Hourglass, ImagePlus, Lightbulb } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion";
import { Magnetic } from "@/components/premium/magnetic";
import { Tilt } from "@/components/premium/tilt";
import { listMemories, type Memory } from "@/lib/memories";
import { listSharedContent, todayKey, type SharedEntry } from "@/lib/shared-content";
import { readAuthSession } from "@/lib/auth/session";

export default async function PrivateHomePage() {
  const session = await readAuthSession((await cookies()).get("mumaa_session")?.value);
  if (!session) redirect("/login");

  const [memories, diary, events, ideas, capsules] = await Promise.all([
    listMemories(),
    listSharedContent("diary", session.email),
    listSharedContent("event", session.email),
    listSharedContent("idea", session.email),
    listSharedContent("capsule", session.email),
  ]);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const firstName = session.name && session.name !== "MUMAA" ? session.name.split(" ")[0] : null;
  // Events arrive upcoming-first; only show one that hasn't already happened.
  const nextEvent = events.find((event) => !event.date || event.date >= todayKey());
  const latestCapsule = capsules.find((capsule) => !capsule.sealed) ?? capsules[0];
  const recalled = recall(memories, new Date());
  const featured = memories.find((memory) => !memory.is_legacy && memory.cover_image_url) ?? memories.find((memory) => !memory.is_legacy);

  return (
    <>
      <section className="welcome" aria-labelledby="home-title">
        <div className="welcome-copy">
          <Reveal><span className="eyebrow">{firstName ? `Welcome home, ${firstName}` : "Welcome home"}</span></Reveal>
          <Reveal delay={0.08}>
            <h1 className="display" id="home-title">
              Two lives.<br /><em>One little universe.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p>
              A place for everything we’ve lived, everything we’re keeping, and
              everything still waiting to happen.
            </p>
            <div className="welcome-meta">
              <span>{today}</span>
              <span>{memories.length} {memories.length === 1 ? "memory" : "memories"}</span>
              <span>{diary.length} diary {diary.length === 1 ? "entry" : "entries"}</span>
            </div>
            <Magnetic>
            <Link className="btn btn-primary btn-lg" href="/memories">
              Explore our memories <ArrowRight aria-hidden="true" />
            </Link>
            </Magnetic>
          </Reveal>
        </div>
        <Reveal delay={0.1} y={40}>
          <figure className="welcome-photo">
            <img src="/images/anna/anna-dearest.jpg" alt="Anna smiling in a light sweater and glasses" />
            <figcaption>Every story begins somewhere.</figcaption>
          </figure>
        </Reveal>
      </section>

      {recalled && <OnThisDay memory={recalled.memory} kind={recalled.kind} />}

      <RevealGroup className="bento">
        <RevealItem className="span-feature">
          <FeatureTile memory={featured} />
        </RevealItem>
        <Tile href="/diary" icon={<BookOpen />} label="Diary" entry={diary[0]} fallback="The first page is still blank." hint="Leave something for later." />
        <Tile href="/events" icon={<CalendarDays />} label="Next up" entry={nextEvent} fallback="Nothing planned yet." hint="Add the next moment together." cherry />
        <Tile href="/ideas" icon={<Lightbulb />} label="Ideas" entry={ideas[0]} fallback="The idea shelf is open." hint="A place, a plan, a someday." />
        <Tile href="/time-capsules" icon={<Hourglass />} label="Time capsules" entry={latestCapsule} fallback="Seal something for later." hint="It opens on the date you choose." />
        <RevealItem className="span-wide">
          <Tilt>
          <Link className="tile" href="/memories/graduation-2026/">
            <div className="tile-top">
              <span className="tile-icon"><GraduationCap aria-hidden="true" /></span>
              <span className="tile-arrow"><ArrowUpRight aria-hidden="true" /></span>
            </div>
            <span className="tile-label">Chapter 01</span>
            <h3>Anna’s graduation</h3>
            <p>A little celebration, a letter, a flight, and a keepsake made with love.</p>
          </Link>
          </Tilt>
        </RevealItem>
        <RevealItem className="span-wide">
          <Tilt>
          <Link className="tile" href="/memories">
            <div className="tile-top">
              <span className="tile-icon"><ImagePlus aria-hidden="true" /></span>
              <span className="tile-arrow"><ArrowUpRight aria-hidden="true" /></span>
            </div>
            <span className="tile-label">The archive</span>
            <h3>Add the next photograph.</h3>
            <p>Every memory you add becomes part of the story.</p>
          </Link>
          </Tilt>
        </RevealItem>
      </RevealGroup>

      <Reveal className="home-closing">
        <h2 className="display">Whatever comes next, <em>we’ll have a place for it.</em></h2>
        <p>mumaa — a private world for two</p>
      </Reveal>
    </>
  );
}

function FeatureTile({ memory }: { memory: Memory | undefined }) {
  return (
    <Tilt>
    <Link className="tile tile-feature" href={memory?.route ?? "/memories"}>
      <img src={memory?.cover_image_url ?? "/images/anna/anna-soft.jpg"} alt="" />
      <div className="tile-feature-body">
        <div className="tile-top">
          <span className="tile-label">{memory ? "Latest memory" : "The archive"}</span>
          <span className="tile-arrow"><ArrowUpRight aria-hidden="true" /></span>
        </div>
        <h3>{memory?.title ?? "The first memory is waiting."}</h3>
        <p>{memory?.excerpt || "Add the first photograph and give this chapter somewhere to begin."}</p>
      </div>
    </Link>
    </Tilt>
  );
}

function Tile({
  href,
  icon,
  label,
  entry,
  fallback,
  hint,
  cherry,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  entry?: SharedEntry;
  fallback: string;
  hint: string;
  cherry?: boolean;
}) {
  return (
    <RevealItem>
      <Tilt>
      <Link className={`tile ${cherry ? "tile-cherry" : ""}`} href={href}>
        <div className="tile-top">
          <span className="tile-icon" aria-hidden="true">{icon}</span>
          <span className="tile-arrow"><ArrowUpRight aria-hidden="true" /></span>
        </div>
        <span className="tile-label">{label}</span>
        <h3>{entry?.title ?? fallback}</h3>
        <p>{entry ? describe(entry) : hint}</p>
      </Link>
      </Tilt>
    </RevealItem>
  );
}

function describe(entry: SharedEntry) {
  if (entry.sealed && entry.unlockAt) {
    return `Sealed until ${new Date(entry.unlockAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`;
  }
  if (entry.type === "event" && entry.date) {
    const when = new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    return [when, entry.location].filter(Boolean).join(" · ");
  }
  return entry.body || "Open to read.";
}

/**
 * A memory from this exact date in an earlier year; failing that, one from this
 * month. Returns nothing when the archive has no such memory, so the card stays hidden.
 */
function recall(memories: Memory[], now: Date) {
  const year = now.getFullYear();
  const monthDay = now.toISOString().slice(5, 10);
  const month = monthDay.slice(0, 2);
  const past = memories.filter((memory) => !memory.is_legacy && memory.date && Number(memory.date.slice(0, 4)) < year);
  const sameDay = past.find((memory) => memory.date!.slice(5, 10) === monthDay);
  if (sameDay) return { memory: sameDay, kind: "day" as const };
  const sameMonth = past.find((memory) => memory.date!.slice(5, 7) === month);
  return sameMonth ? { memory: sameMonth, kind: "month" as const } : null;
}

function OnThisDay({ memory, kind }: { memory: Memory; kind: "day" | "month" }) {
  const yearsAgo = new Date().getFullYear() - Number(memory.date!.slice(0, 4));
  const when = yearsAgo === 1 ? "One year ago" : `${yearsAgo} years ago`;
  return (
    <Reveal className="recall">
      <Link className="recall-card" href={memory.route}>
        <div className="recall-media">
          {memory.cover_image_url ? <img src={memory.cover_image_url} alt="" /> : <div className="placeholder-art">{memory.title}</div>}
        </div>
        <div className="recall-copy">
          <span className="eyebrow">{kind === "day" ? `On this day · ${when}` : `This month · ${when}`}</span>
          <h2 className="display">{memory.title}</h2>
          {memory.excerpt && <p>{memory.excerpt}</p>}
          <span className="text-link">Revisit it <ArrowUpRight aria-hidden="true" /></span>
        </div>
      </Link>
    </Reveal>
  );
}
