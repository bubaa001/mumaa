/** Shown inside the shell the instant a section is tapped, while its data loads. */
export default function SectionLoading() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div className="skeleton-head">
        <span className="skeleton-line" style={{ width: 96 }} />
        <span className="skeleton-line skeleton-title" style={{ width: "62%" }} />
        <span className="skeleton-line skeleton-title" style={{ width: "38%" }} />
        <span className="skeleton-line" style={{ width: "44%", marginTop: 12 }} />
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="skeleton-card" key={index} style={{ animationDelay: `${index * 0.08}s` }} />
        ))}
      </div>
    </div>
  );
}
