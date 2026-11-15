import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { listMemories, type Memory } from "./lib/memories";
import "./landing.css";

function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <a className="memory-card" href={memory.route}>
      <div className="memory-card-art" aria-hidden="true">
        <span>✦</span>
        <small>{new Date(memory.created_at).getFullYear()}</small>
      </div>
      <div className="memory-card-copy">
        <p className="memory-card-label">MEMORY · {memory.slug.replaceAll("-", " ")}</p>
        <h2>{memory.title}</h2>
        <p>{memory.excerpt}</p>
        <span className="memory-card-link">OPEN MEMORY <b>↗</b></span>
      </div>
    </a>
  );
}

function Landing() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listMemories().then(setMemories).catch(() => {
      setError("The archive is taking a moment to wake up.");
    });
  }, []);

  return (
    <main className="archive-page">
      <section className="archive-hero">
        <div className="archive-noise" aria-hidden="true" />
        <nav className="archive-nav">
          <span className="archive-mark">M</span>
          <span className="archive-nav-label">A PRIVATE ARCHIVE OF US</span>
        </nav>
        <div className="archive-hero-copy">
          <p className="archive-kicker">THE MOMENTS THAT STAY</p>
          <h1>Some things<br /><em>deserve a place</em><br />to return to.</h1>
          <p className="archive-intro">
            A growing collection of letters, celebrations, little adventures,
            and the ordinary moments that became everything.
          </p>
          <a className="archive-scroll" href="#memories">EXPLORE MEMORIES <span>↓</span></a>
        </div>
        <div className="archive-orbit archive-orbit-one" aria-hidden="true" />
        <div className="archive-orbit archive-orbit-two" aria-hidden="true" />
        <p className="archive-hero-footer">MADE WITH LOVE · SINCE 2026</p>
      </section>

      <section className="memories-section" id="memories">
        <div className="memories-heading">
          <div>
            <p className="archive-kicker archive-kicker-dark">THE ARCHIVE</p>
            <h2>For the days<br /><em>worth keeping.</em></h2>
          </div>
          <p>Every memory is a small doorway back to how it felt.</p>
        </div>
        {error && <p className="archive-error" role="status">{error}</p>}
        <div className="memory-grid">
          {memories.length > 0
            ? memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)
            : <p className="archive-loading">Opening the archive…</p>}
        </div>
      </section>
      <footer className="archive-footer">KEEP THE GOOD THINGS CLOSE <span>♥</span></footer>
    </main>
  );
}

const mountNode = document.getElementById("archive-root");
if (mountNode) createRoot(mountNode).render(<Landing />);
