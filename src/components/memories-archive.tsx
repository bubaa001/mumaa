"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Memory } from "@/lib/memories";
import { MemoryCreateForm } from "./memory-create-form";

const pageSize = 12;

export function MemoriesArchive({ memories }: { memories: Memory[] }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const years = Array.from(new Set(memories.map((memory) => memory.date?.slice(0, 4)).filter(Boolean))) as string[];
  const filtered = useMemo(() => memories.filter((memory) => {
    const haystack = `${memory.title} ${memory.excerpt} ${memory.location ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (year === "all" || memory.date?.startsWith(year));
  }), [memories, query, year]);
  const visible = filtered.slice(0, visibleCount);
  const feature = memories.find((memory) => !memory.is_legacy && memory.images.length) ?? memories[0];

  return (
    <div className="memories-page">
      <header className="memories-intro">
        <div>
          <p className="memory-eyebrow">The archive</p>
          <h1>Moments worth keeping.</h1>
          <p className="memories-lede">A living collection of the days, photographs, and small details that make this world ours.</p>
        </div>
        <div className="memories-intro-actions">
          <div className="memories-count"><strong>{memories.length}</strong><span>{memories.length === 1 ? "memory saved" : "memories saved"}</span></div>
          <button className="memory-primary-button" type="button" onClick={() => setComposerOpen(true)}>Add a memory <span aria-hidden="true">+</span></button>
        </div>
      </header>

      {composerOpen && <MemoryCreateForm onClose={() => setComposerOpen(false)} />}

      <section className="memory-featured" aria-label="Featured memory">
        <div className="memory-featured-image">
          {feature.cover_image_url ? <img src={feature.cover_image_url} alt={feature.title} /> : <div className="memory-image-placeholder">The first chapter is waiting for its photograph.</div>}
        </div>
        <div className="memory-featured-copy">
          <p className="memory-eyebrow">{feature.is_legacy ? "Chapter 01" : "Latest addition"}</p>
          <h2>{feature.title}</h2>
          <p>{feature.excerpt}</p>
          <Link className="memory-text-link" href={feature.route}>Open this memory <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="memory-archive" aria-labelledby="archive-heading">
        <div className="memory-archive-heading">
          <div>
            <p className="memory-eyebrow">Browse by feeling, place, or year</p>
            <h2 id="archive-heading">The full archive</h2>
          </div>
          <p>{filtered.length} {filtered.length === 1 ? "memory" : "memories"}</p>
        </div>
        <div className="memory-filters">
          <label className="memory-search">
            <span className="sr-only">Search memories</span>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(pageSize); }} placeholder="Search the archive" />
          </label>
          <label>
            <span className="sr-only">Filter by year</span>
            <select value={year} onChange={(event) => { setYear(event.target.value); setVisibleCount(pageSize); }}>
              <option value="all">Every year</option>
              {years.sort().reverse().map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="memory-grid">
            {visible.map((memory) => <MemoryArchiveItem key={memory.id} memory={memory} />)}
          </div>
        ) : (
          <div className="memory-empty-result">
            <h3>No moments match that search.</h3>
            <p>Try a different word, or add the next memory to the archive.</p>
          </div>
        )}
        {visibleCount < filtered.length && (
          <button className="memory-load-more" type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>Show more memories</button>
        )}
      </section>
    </div>
  );
}

function MemoryArchiveItem({ memory }: { memory: Memory }) {
  return (
    <article className={`memory-archive-item ${memory.is_legacy ? "memory-archive-item-legacy" : ""}`}>
      <Link href={memory.route} className="memory-card-link">
        <div className="memory-card-image">
          {memory.cover_image_url ? <img src={memory.cover_image_url} alt={memory.title} loading="lazy" /> : <div className="memory-image-placeholder">No photograph yet</div>}
        </div>
        <div className="memory-card-copy">
          <p>{memory.date ? new Date(`${memory.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Undated"}</p>
          <h3>{memory.title}</h3>
          {memory.location && <span>{memory.location}</span>}
        </div>
      </Link>
    </article>
  );
}
