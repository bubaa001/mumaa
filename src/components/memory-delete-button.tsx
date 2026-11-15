"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MemoryDeleteButton({ memoryId }: { memoryId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Delete this memory and its photographs? This cannot be undone.")) return;
    setDeleting(true);
    const response = await fetch(`/api/memories/${memoryId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "The memory could not be deleted.");
      setDeleting(false);
      return;
    }
    router.push("/memories");
    router.refresh();
  }

  return (
    <div>
      <button className="memory-delete-button" type="button" onClick={remove} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete this memory"}
      </button>
      {error && <p className="memory-form-error" role="alert">{error}</p>}
    </div>
  );
}
