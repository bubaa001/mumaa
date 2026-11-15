"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SharedContentType, SharedEntry } from "@/lib/shared-content";

const config: Record<SharedContentType, { eyebrow: string; title: string; description: string; action: string; empty: string; bodyLabel: string }> = {
  diary: { eyebrow: "Between the lines", title: "Words worth keeping.", description: "A place for the things we say, the things we mean, and the things we want to remember.", action: "Write an entry", empty: "The first entry is still unwritten.", bodyLabel: "What do you want to say?" },
  event: { eyebrow: "The days ahead", title: "Make room for what comes next.", description: "Keep the plans that deserve more than a passing mention.", action: "Add a moment", empty: "No moments on the calendar yet.", bodyLabel: "What is happening?" },
  idea: { eyebrow: "Little plans, big possibilities", title: "Things we might do.", description: "A shared shelf for the possibilities we want to come back to.", action: "Create an idea", empty: "The idea board is waiting for its first possibility.", bodyLabel: "Tell us a little more" },
  capsule: { eyebrow: "For later", title: "For a future version of you.", description: "Seal a thought, a letter, or a promise until the date you choose.", action: "Seal a capsule", empty: "Nothing has been sealed for later.", bodyLabel: "What should future us read?" },
};

export function SharedModule({ type, entries, currentEmail }: { type: SharedContentType; entries: SharedEntry[]; currentEmail: string }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(entries);
  const copy = config[type];
  const isCapsule = type === "capsule";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("type", type);
    const response = await fetch("/api/content", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "This could not be saved.");
      setSaving(false);
      return;
    }
    setVisible((current) => [result.entry, ...current]);
    setComposerOpen(false);
    setSaving(false);
  }

  return (
    <div className="shared-module">
      <header className="shared-module-hero">
        <div>
          <p className="memory-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <button className="memory-primary-button" type="button" onClick={() => setComposerOpen(true)}>{copy.action} <span aria-hidden="true">+</span></button>
      </header>
      {composerOpen && (
        <section className="shared-composer">
          <div className="memory-composer-heading">
            <div><p className="memory-eyebrow">Add to our world</p><h2>Make it real.</h2></div>
            <button className="memory-close-button" type="button" onClick={() => setComposerOpen(false)} aria-label="Close form">×</button>
          </div>
          <form className="memory-form" onSubmit={submit}>
            <label><span>Title <b aria-hidden="true">*</b></span><input name="title" required placeholder={type === "event" ? "A Sunday worth planning" : type === "idea" ? "A place we should visit" : "A note for us"} /></label>
            <div className="memory-form-grid">
              <label><span>{isCapsule ? "Unlock date" : type === "event" ? "Date" : "Date"}</span><input name={isCapsule ? "unlockAt" : "date"} type={isCapsule ? "datetime-local" : "date"} /></label>
              {(type === "event" || type === "idea") && <label><span>{type === "event" ? "Place" : "Status"}</span>{type === "event" ? <input name="location" placeholder="Where it happens" /> : <select name="status" defaultValue="open"><option value="open">Open possibility</option><option value="planned">Planned</option><option value="done">Done</option></select>}</label>}
            </div>
            <label><span>{copy.bodyLabel}</span><textarea name="body" rows={6} placeholder="Write it in your own words." /></label>
            {error && <p className="memory-form-error" role="alert">{error}</p>}
            <div className="memory-form-actions"><button className="memory-secondary-button" type="button" onClick={() => setComposerOpen(false)}>Cancel</button><button className="memory-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save it"}</button></div>
          </form>
        </section>
      )}
      <section className="shared-entry-list" aria-label={copy.eyebrow}>
        {visible.length === 0 ? <div className="shared-empty"><h2>{copy.empty}</h2><p>Start with something small. It can grow from there.</p></div> : visible.map((entry) => <SharedEntryCard key={entry.id} entry={entry} canDelete={entry.authorEmail === currentEmail} />)}
      </section>
    </div>
  );
}

function SharedEntryCard({ entry, canDelete }: { entry: SharedEntry; canDelete: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function remove() {
    if (!window.confirm("Delete this entry?")) return;
    const response = await fetch(`/api/content/${entry.type}/${entry.id}`, { method: "DELETE" });
    if (!response.ok) { setError((await response.json()).error ?? "Could not delete."); return; }
    router.refresh();
  }
  return <article className="shared-entry"><div><p className="shared-entry-date">{entry.date ?? entry.unlockAt ?? "No date"}</p><h2>{entry.title}</h2>{entry.location && <p className="shared-entry-place">{entry.location}</p>}</div><div><p>{entry.body || "A moment saved for us."}</p>{entry.status && <span className="shared-entry-status">{entry.status}</span>}{canDelete && <button className="memory-delete-button" type="button" onClick={remove}>Delete</button>}{error && <small className="memory-form-error">{error}</small>}</div></article>;
}
