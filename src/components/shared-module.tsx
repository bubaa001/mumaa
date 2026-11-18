"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, CalendarDays, Hourglass, Lightbulb, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import type { SharedContentType, SharedEntry } from "@/lib/shared-content";
import { PageHead } from "./mumaa-shell";
import { ease } from "./motion";
import { Sheet } from "./sheet";

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
    description: "Seal a thought, a letter, or a promise until the date you choose. It appears here once it opens.",
    action: "Seal a capsule",
    empty: "No capsules have opened yet.",
    emptyHint: "Sealed capsules stay hidden until their date arrives.",
    bodyLabel: "What should future us read?",
    placeholder: "Open this on our anniversary",
    icon: Hourglass,
  },
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function SharedModule({ type, entries, currentEmail }: { type: SharedContentType; entries: SharedEntry[]; currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(entries);
  const copy = config[type];
  const isCapsule = type === "capsule";
  const Icon = copy.icon;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("type", type);
    try {
      const response = await fetch("/api/content", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "This could not be saved.");
      const entry = result.entry as SharedEntry;
      const sealed = isCapsule && entry.unlockAt && Date.parse(entry.unlockAt) > Date.now();
      if (!sealed) setVisible((current) => [entry, ...current]);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
        <div className="count">
          <strong>{visible.length}</strong>
          <span>{visible.length === 1 ? "entry" : "entries"}</span>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" /> {copy.action}
        </button>
      </PageHead>

      <Sheet open={open} onClose={() => setOpen(false)} eyebrow={copy.eyebrow} title={<>Make it <em>real.</em></>}>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Title <b aria-hidden="true">*</b></span>
            <input className="field-input" name="title" required maxLength={120} placeholder={copy.placeholder} autoFocus />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{isCapsule ? "Opens on" : "Date"}</span>
              <input className="field-input" name={isCapsule ? "unlockAt" : "date"} type={isCapsule ? "datetime-local" : "date"} />
            </label>
            {type === "event" && (
              <label className="field">
                <span>Place</span>
                <input className="field-input" name="location" placeholder="Where it happens" />
              </label>
            )}
            {type === "idea" && (
              <label className="field">
                <span>Status</span>
                <select className="field-input" name="status" defaultValue="open">
                  <option value="open">Open possibility</option>
                  <option value="planned">Planned</option>
                  <option value="done">Done</option>
                </select>
              </label>
            )}
          </div>
          <label className="field">
            <span>{copy.bodyLabel}</span>
            <textarea className="field-input" name="body" rows={6} placeholder="Write it in your own words." />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-cherry" type="submit" disabled={saving}>{saving ? "Saving…" : isCapsule ? "Seal it" : "Save it"}</button>
          </div>
        </form>
      </Sheet>

      {visible.length === 0 ? (
        <div className="empty">
          <span className="empty-mark"><Icon aria-hidden="true" /></span>
          <h2>{copy.empty}</h2>
          <p>{copy.emptyHint}</p>
          <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)} style={{ marginTop: 12 }}>
            <Plus aria-hidden="true" /> {copy.action}
          </button>
        </div>
      ) : (
        <motion.section className="entries" aria-label={copy.eyebrow} layout>
          <AnimatePresence initial={false}>
            {visible.map((entry, index) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                index={index}
                canDelete={entry.authorEmail === currentEmail}
                onDeleted={() => setVisible((current) => current.filter((item) => item.id !== entry.id))}
              />
            ))}
          </AnimatePresence>
        </motion.section>
      )}
    </>
  );
}

function EntryCard({ entry, index, canDelete, onDeleted }: { entry: SharedEntry; index: number; canDelete: boolean; onDeleted: () => void }) {
  const reduce = useReducedMotion();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const date = formatDate(entry.date ?? entry.unlockAt);

  async function remove() {
    if (!window.confirm("Delete this entry? This can’t be undone.")) return;
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
      className="entry"
      layout
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.6, ease, delay: Math.min(index, 6) * 0.05 }}
    >
      <div className="entry-meta">
        {date && <span><CalendarDays aria-hidden="true" /> {date}</span>}
        {entry.location && <span><MapPin aria-hidden="true" /> {entry.location}</span>}
        {entry.status && <span className={`chip chip-${entry.status}`}>{entry.status}</span>}
      </div>
      <h2>{entry.title}</h2>
      {entry.body && <p>{entry.body}</p>}
      <div className="entry-foot">
        <span>by <em>{entry.authorName}</em></span>
        {canDelete && (
          <button className="danger-link" type="button" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
    </motion.article>
  );
}
