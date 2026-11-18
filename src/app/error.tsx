"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="system">
      <div>
        <span className="eyebrow">mumaa</span>
        <h1 className="display">Something needs <em>a second look.</em></h1>
        <button className="btn btn-primary" onClick={reset} type="button">Try again</button>
      </div>
    </main>
  );
}
