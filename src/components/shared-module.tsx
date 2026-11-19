"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, CalendarDays, Hourglass, Lightbulb, Lock, MapPin, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { SharedContentType, SharedEntry } from "@/lib/shared-content";
import { PageHead } from "./mumaa-shell";
import { ease } from "./motion";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

const config: Record<
  SharedContentType,
  {
    eyebrow: string;
    title: React.ReactNode;
    description: string;
    action: string;
    empty: string;
    emptyHint: string;
    bodyLabel: string;
    placeholder: string;
    icon: typeof BookOpen;
  }
> = {
  diary: {
    eyebrow: "Diary",
    title: <>Words worth <em>keeping.</em></>,
    description: "The things we say, the things we mean, and the things we want to remember saying.",
    action: "Write an entry",
    empty: "The first page is still blank.",
    emptyHint: "Leave something here for the version of you that comes back later.",
    bodyLabel: "What do you want to say?",
    placeholder: "A note for us",
    icon: BookOpen,
  },
  event: {
    eyebrow: "Events",
    title: <>The days <em>ahead.</em></>,
    description: "The plans that deserve more than a passing mention.",
    action: "Add a moment",
    empty: "Nothing on the calendar yet.",
    emptyHint: "Plan the first one together.",
    bodyLabel: "What’s happening?",
    placeholder: "A Sunday worth planning",
    icon: CalendarDays,
  },
  idea: {
    eyebrow: "Ideas",
    title: <>Things we <em>might</em> do.</>,
    description: "A shared shelf for the possibilities we want to come back to.",
    action: "Add an idea",
    empty: "The shelf is waiting for its first idea.",
    emptyHint: "A place to visit, a thing to try, a someday.",
    bodyLabel: "Tell us a little more",
    placeholder: "A place we should visit",
    icon: Lightbulb,
  },
  capsule: {
    eyebrow: "Time capsules",
    title: <>For a future <em>us.</em></>,
    description: "Seal a thought, a letter, or a promise until the date you choose. Its words stay hidden until then.",
    action: "Seal a capsule",
    empty: "No capsules yet.",
    emptyHint: "Write something now and choose when it opens.",
    bodyLabel: "What should future us read?",
    placeholder: "Open this on our anniversary",
    icon: Hourglass,
  },
};

const utcToday = () => new Date().toISOString().slice(0, 10);
const localToday = () => new Date().toLocaleDateString("en-CA");

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatInstant(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function countdown(target: string, now: number) {
  const minutes = Math.max(0, Math.round((Date.parse(target) - now) / 60000));
  if (minutes < 60) return `Opens in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Opens in ${hours} hours`;
  return `Opens in ${Math.round(hours / 24)} days`;
}

function groupEntries(type: SharedContentType, entries: SharedEntry[], today: string) {
  if (type === "event") {
    const upcoming = entries.filter((entry) => entry.date && entry.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
    const someday = entries.filter((entry) => !entry.date);
    const past = entries.filter((entry) => entry.date && entry.date < today).sort((a, b) => b.date!.localeCompare(a.date!));
    return [
      { label: "Coming up", items: upcoming },
      { label: "Someday", items: someday },
      { label: "Past", items: past },
    ].filter((group) => group.items.length);
  }
  if (type === "capsule") {
    return [
      { label: "Opened", items: entries.filter((entry) => !entry.sealed) },
      { label: "Still sealed", items: entries.filter((entry) => entry.sealed) },
    ].filter((group) => group.items.length);
  }
  return [{ label: "", items: entries }];
}

async function send(url: string, method: string, form: FormData) {
  const response = await fetch(url, { method, body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "This could not be saved.");
  return result.entry as SharedEntry;
}

export function SharedModule({ type, entries, currentEmail }: { type: SharedContentType; entries: SharedEntry[]; currentEmail: string }) {
  const [composer, setComposer] = useState<{ mode: "create" } | { mode: "edit"; entry: SharedEntry } | null>(null);
  const [visible, setVisible] = useState(entries);
  const [today, setToday] = useState(utcToday);
  const [now, setNow] = useState<number | null>(null);
  const toast = useToast();
  const copy = config[type];
  const Icon = copy.icon;

  useEffect(() => {
    setToday(localToday());
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function save(form: FormData) {
    if (composer?.mode === "edit") {
      const entry = await send(`/api/content/${type}/${composer.entry.id}`, "PATCH", form);
      setVisible((current) => current.map((item) => (item.id === entry.id ? entry : item)));
      toast("Changes saved");
    } else {
      form.set("type", type);
      const entry = await send("/api/content", "POST", form);
      const sealed = type === "capsule" && Boolean(entry.unlockAt) && Date.parse(entry.unlockAt!) > Date.now();
      setVisible((current) => [{ ...entry, sealed, body: sealed ? "" : entry.body }, ...current]);
      toast(sealed ? "Sealed until it’s time" : "Saved");
    }
    setComposer(null);
  }

  const groups = groupEntries(type, visible, today);

  return (
    <>
      <PageHead eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
        <div className="count">
          <strong>{visible.length}</strong>
          <span>{visible.length === 1 ? "entry" : "entries"}</span>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setComposer({ mode: "create" })}>
          <Plus aria-hidden="true" /> {copy.action}
        </button>
      </PageHead>

      <Sheet
        open={Boolean(composer)}
        onClose={() => setComposer(null)}
        eyebrow={composer?.mode === "edit" ? `Edit · ${copy.eyebrow}` : copy.eyebrow}
        title={composer?.mode === "edit" ? <>Change <em>a detail.</em></> : <>Make it <em>real.</em></>}
      >
        {composer && (
          <EntryForm
            key={composer.mode === "edit" ? composer.entry.id : "new"}
            type={type}
            entry={composer.mode === "edit" ? composer.entry : undefined}
            onCancel={() => setComposer(null)}
            onSubmit={save}
          />
        )}
      </Sheet>

      {visible.length === 0 ? (
        <div className="empty">
          <span className="empty-mark"><Icon aria-hidden="true" /></span>
          <h2>{copy.empty}</h2>
          <p>{copy.emptyHint}</p>
          <button className="btn btn-ghost" type="button" onClick={() => setComposer({ mode: "create" })} style={{ marginTop: 12 }}>
            <Plus aria-hidden="true" /> {copy.action}
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section className="entry-group" key={group.label || "all"} aria-label={group.label || copy.eyebrow}>
            {group.label && (
              <h2 className="entry-group-title">
                {group.label} <span>{group.items.length}</span>
              </h2>
            )}
            <motion.div className="entries" layout>
              <AnimatePresence initial={false}>
                {group.items.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    now={now}
                    isPast={type === "event" && Boolean(entry.date && entry.date < today)}
                    canChange={entry.authorEmail === currentEmail}
                    onEdit={() => setComposer({ mode: "edit", entry })}
                    onDeleted={() => {
                      setVisible((current) => current.filter((item) => item.id !== entry.id));
                      toast("Deleted");
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </section>
        ))
      )}
    </>
  );
}

function EntryForm({
  type,
  entry,
  onSubmit,
  onCancel,
}: {
  type: SharedContentType;
  entry?: SharedEntry;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const copy = config[type];
  const isCapsule = type === "capsule";
  const editing = Boolean(entry);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const unlock = String(form.get("unlockAt") ?? "");
    // datetime-local has no time zone; send the exact instant the person meant.
    if (unlock) form.set("unlockAt", new Date(unlock).toISOString());
    try {
      await onSubmit(form);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This could not be saved.");
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Title <b aria-hidden="true">*</b></span>
        <input className="field-input" name="title" required maxLength={120} placeholder={copy.placeholder} defaultValue={entry?.title} autoFocus />
      </label>
      <div className="form-grid">
        {isCapsule ? (
          !editing && (
            <label className="field">
              <span>Opens on</span>
              <input className="field-input" name="unlockAt" type="datetime-local" />
            </label>
          )
        ) : (
          <label className="field">
            <span>Date</span>
            <input className="field-input" name="date" type="date" defaultValue={entry?.date ?? ""} />
          </label>
        )}
        {type === "event" && (
          <label className="field">
            <span>Place</span>
            <input className="field-input" name="location" placeholder="Where it happens" defaultValue={entry?.location ?? ""} />
          </label>
        )}
        {type === "idea" && (
          <label className="field">
            <span>Status</span>
            <select className="field-input" name="status" defaultValue={entry?.status ?? "open"}>
              <option value="open">Open possibility</option>
              <option value="planned">Planned</option>
              <option value="done">Done</option>
            </select>
          </label>
        )}
      </div>
      <label className="field">
        <span>{copy.bodyLabel}</span>
        <textarea className="field-input" name="body" rows={6} placeholder="Write it in your own words." defaultValue={entry?.body} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn btn-cherry" type="submit" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : isCapsule ? "Seal it" : "Save it"}
        </button>
      </div>
    </form>
  );
}

function EntryCard({
  entry,
  now,
  isPast,
  canChange,
  onEdit,
  onDeleted,
}: {
  entry: SharedEntry;
  now: number | null;
  isPast: boolean;
  canChange: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const reduce = useReducedMotion();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const date = entry.type === "capsule" ? (entry.unlockAt ? formatInstant(entry.unlockAt) : null) : formatDate(entry.date);

  async function remove() {
    if (!window.confirm(entry.sealed ? "Delete this sealed capsule? It will never open." : "Delete this entry? This can’t be undone.")) return;
    setBusy(true);
    const response = await fetch(`/api/content/${entry.type}/${entry.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError((await response.json().catch(() => ({}))).error ?? "Could not delete.");
      setBusy(false);
      return;
    }
    onDeleted();
  }

  return (
    <motion.article
      className={`entry ${entry.sealed ? "entry-sealed" : ""} ${isPast ? "entry-past" : ""}`}
      layout
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.6, ease }}
    >
      <div className="entry-meta">
        {entry.sealed && <span className="chip chip-sealed"><Lock aria-hidden="true" /> Sealed</span>}
        {date && <span><CalendarDays aria-hidden="true" /> {entry.type === "capsule" && entry.sealed ? `Opens ${date}` : date}</span>}
        {entry.location && <span><MapPin aria-hidden="true" /> {entry.location}</span>}
        {entry.status && <span className={`chip chip-${entry.status}`}>{entry.status}</span>}
      </div>
      <h2>{entry.title}</h2>
      {entry.sealed ? (
        <p className="entry-countdown">{now && entry.unlockAt ? countdown(entry.unlockAt, now) : "Waiting for its day."}</p>
      ) : (
        entry.body && <p>{entry.body}</p>
      )}
      <div className="entry-foot">
        <span>by <em>{entry.authorName}</em></span>
        {canChange && (
          <span className="entry-actions">
            {!entry.sealed && (
              <button className="danger-link" type="button" onClick={onEdit}>
                <Pencil aria-hidden="true" /> Edit
              </button>
            )}
            <button className="danger-link" type="button" onClick={remove} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </button>
          </span>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
    </motion.article>
  );
}
