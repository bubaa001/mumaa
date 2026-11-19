"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

type Editable = { id: string; title: string; date: string | null; location: string | null; body: string };

export function MemoryEditButton({ memory }: { memory: Editable }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/memories/${memory.id}`, { method: "PATCH", body: new FormData(event.currentTarget) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The memory could not be saved.");
      setOpen(false);
      toast("Changes saved");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The memory could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="danger-link" type="button" onClick={() => setOpen(true)}>
        <Pencil aria-hidden="true" /> Edit this memory
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} eyebrow="Edit memory" title={<>Change <em>a detail.</em></>}>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Title <b aria-hidden="true">*</b></span>
            <input className="field-input" name="title" required maxLength={120} defaultValue={memory.title} autoFocus />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Date</span>
              <input className="field-input" name="date" type="date" defaultValue={memory.date ?? ""} />
            </label>
            <label className="field">
              <span>Place</span>
              <input className="field-input" name="location" maxLength={120} defaultValue={memory.location ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>What do you want to remember?</span>
            <textarea className="field-input" name="body" rows={6} maxLength={3000} defaultValue={memory.body} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-cherry" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
