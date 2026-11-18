"use client";

import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "./sheet";

export function MemoryCreateForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected.slice(0, 6));
    setError(selected.length > 6 ? "Only the first six photographs will be added." : "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.delete("images");
    files.forEach((file) => formData.append("images", file));

    try {
      const response = await fetch("/api/memories", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The memory could not be saved.");
      router.push(`/memories/${result.memory.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The memory could not be saved.");
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="New memory"
      title={<>Give the moment <em>a home.</em></>}
      description="Add as much or as little as you remember."
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Title <b aria-hidden="true">*</b></span>
          <input className="field-input" name="title" required maxLength={120} placeholder="Anna’s graduation dinner" autoFocus />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Date</span>
            <input className="field-input" name="date" type="date" />
          </label>
          <label className="field">
            <span>Place</span>
            <input className="field-input" name="location" maxLength={120} placeholder="Where it happened" />
          </label>
        </div>
        <label className="field">
          <span>What do you want to remember?</span>
          <textarea className="field-input" name="body" rows={5} maxLength={3000} placeholder="A few words, a story, or a note for later." />
        </label>
        <div className="field">
          <span>Photographs</span>
          <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={chooseFiles} tabIndex={-1} />
          <button type="button" className="dropzone" onClick={() => fileInput.current?.click()}>
            <ImagePlus aria-hidden="true" />
            <strong>{files.length ? `${files.length} photograph${files.length === 1 ? "" : "s"} chosen` : "Choose photographs"}</strong>
            <small>Up to six · JPG, PNG, WEBP or GIF · 8 MB each</small>
          </button>
          {previews.length > 0 && (
            <div className="thumbs" aria-live="polite">
              {previews.map((url, index) => <img key={url} src={url} alt={files[index]?.name ?? ""} />)}
            </div>
          )}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-cherry" disabled={saving}>
            {saving ? "Saving…" : "Save memory"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
