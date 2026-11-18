"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ImagePlus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Memory } from "@/lib/memories";
import { formatMemoryDate } from "@/lib/format";
import { PageHead } from "./mumaa-shell";
import { MemoryCreateForm } from "./memory-create-form";
import { Reveal, ease } from "./motion";

const pageSize = 12;

export function MemoriesArchive({ memories }: { memories: Memory[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const years = useMemo(
    () => (Array.from(new Set(memories.map((memory) => memory.date?.slice(0, 4)).filter(Boolean))) as string[]).sort().reverse(),
    [memories],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const haystack = `${memory.title} ${memory.excerpt} ${memory.location ?? ""}`.toLowerCase();
      return haystack.includes(needle) && (year === "all" || memory.date?.startsWith(year));
    });
  }, [memories, query, year]);
  const visible = filtered.slice(0, visibleCount);
  const feature = memories.find((memory) => !memory.is_legacy && memory.cover_image_url) ?? memories[0];

  return (
    <>
      <PageHead
        eyebrow="Memories"
        title={<>Moments worth <em>keeping.</em></>}
        description="A living collection of the days, photographs, and small details that make this world ours."
      >
        <div className="count">
          <strong>{memories.length}</strong>
          <span>{memories.length === 1 ? "memory" : "memories"}</span>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" /> Add a memory
        </button>
      </PageHead>

      <MemoryCreateForm open={open} onClose={() => setOpen(false)} />

      {feature && (
        <Reveal>
          <Link className="featured" href={feature.route} aria-label={`Open ${feature.title}`}>
            <div className="featured-media">
              {feature.cover_image_url ? (
                <img src={feature.cover_image_url} alt="" />
              ) : feature.is_legacy ? (
                <img src="/images/anna/anna-schoolyard.jpg" alt="" style={{ objectPosition: "50% 30%" }} />
              ) : (
                <div className="placeholder-art">The first chapter is waiting for its photograph.</div>
              )}
            </div>
            <div className="featured-body">
              <span className="eyebrow">{feature.is_legacy ? "Chapter 01" : "Latest"}</span>
              <h2 className="display">{feature.title}</h2>
              <p>{feature.excerpt}</p>
              <span className="btn btn-light">Open this memory <ArrowRight aria-hidden="true" /></span>
            </div>
          </Link>
        </Reveal>
      )}

      <section aria-labelledby="archive-heading">
        <div className="toolbar">
          <div>
            <span className="eyebrow">{filtered.length} {filtered.length === 1 ? "memory" : "memories"}</span>
            <h2 className="display" id="archive-heading">The full archive</h2>
          </div>
          <div className="filters">
            <label className="search">
              <span className="sr-only">Search memories</span>
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(pageSize); }}
                placeholder="Search by title or place"
              />
            </label>
            {years.length > 1 && (
              <label>
                <span className="sr-only">Filter by year</span>
                <select className="select" value={year} onChange={(event) => { setYear(event.target.value); setVisibleCount(pageSize); }}>
                  <option value="all">Every year</option>
                  {years.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        {visible.length ? (
          <motion.div className="grid-cards" layout>
            <AnimatePresence mode="popLayout">
              {visible.map((memory, index) => <MemoryCard key={memory.id} memory={memory} index={index} />)}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="empty">
            <span className="empty-mark"><ImagePlus aria-hidden="true" /></span>
            <h3>Nothing matches that.</h3>
            <p>Try a different word, or add the next memory to the archive.</p>
          </div>
        )}

        {visibleCount < filtered.length && (
          <div className="load-more">
            <button className="btn btn-ghost" type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>
              Show more memories
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function MemoryCard({ memory, index }: { memory: Memory; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.7, ease, delay: (index % pageSize) * 0.04 }}
    >
      <Link href={memory.route} className="memory-card">
        <div className="memory-card-media">
          {memory.is_legacy && <span className="memory-card-tag">Chapter 01</span>}
          {memory.cover_image_url ? (
            <img src={memory.cover_image_url} alt="" loading="lazy" />
          ) : memory.is_legacy ? (
            <img src="/images/anna/anna-schoolyard.jpg" alt="" loading="lazy" style={{ objectPosition: "50% 30%" }} />
          ) : (
            <div className="placeholder-art placeholder-art-light">No photograph yet</div>
          )}
        </div>
        <div className="memory-card-body">
          <small>{formatMemoryDate(memory.date)}</small>
          <h3>{memory.title}</h3>
          {memory.location && <span>{memory.location}</span>}
        </div>
      </Link>
    </motion.article>
  );
}
