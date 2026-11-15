"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function MemoryCreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected.slice(0, 6));
    setError(selected.length > 6 ? "Only the first six images will be added." : "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch("/api/memories", {
      method: "POST",
      body: (() => {
        const formData = new FormData(event.currentTarget);
        files.forEach((file) => formData.append("images", file));
        return formData;
      })(),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "The memory could not be saved.");
      setSaving(false);
      return;
    }

    router.push(`/memories/${result.memory.id}`);
    router.refresh();
  }

  return (
    <section className="memory-composer" aria-labelledby="memory-composer-title">
      <div className="memory-composer-heading">
        <div>
          <p className="memory-eyebrow">New memory</p>
          <h2 id="memory-composer-title">Give the moment a home.</h2>
          <p>Add as much or as little as you remember. You can always make another one later.</p>
        </div>
        <button className="memory-close-button" type="button" onClick={onClose} aria-label="Close memory form">
          ×
        </button>
      </div>

      <form className="memory-form" onSubmit={submit}>
        <label>
          <span>Title <b aria-hidden="true">*</b></span>
          <input name="title" required maxLength={120} placeholder="Anna's graduation dinner" />
        </label>
        <div className="memory-form-grid">
          <label>
            <span>Date</span>
            <input name="date" type="date" />
          </label>
          <label>
            <span>Place</span>
            <input name="location" maxLength={120} placeholder="Where it happened" />
          </label>
        </div>
        <label>
          <span>What do you want to remember?</span>
          <textarea name="body" rows={5} maxLength={3000} placeholder="A few words, a story, or a note for later." />
        </label>
        <div className="memory-upload">
          <div>
            <span className="memory-field-label">Photographs</span>
            <p>Up to six images. JPG, PNG, WEBP, or GIF, 8 MB each.</p>
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={chooseFiles} />
          <button type="button" className="memory-upload-button" onClick={() => fileInput.current?.click()}>
            {files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose photographs"}
          </button>
          {files.length > 0 && (
            <div className="memory-file-list" aria-live="polite">
              {files.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}
            </div>
          )}
        </div>
        {error && <p className="memory-form-error" role="alert">{error}</p>}
        <div className="memory-form-actions">
          <button type="button" className="memory-secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="memory-primary-button" disabled={saving}>
            {saving ? "Saving memory..." : "Save memory"}
          </button>
        </div>
      </form>
    </section>
  );
}
