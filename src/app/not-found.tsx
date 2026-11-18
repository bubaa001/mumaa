import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system">
      <div>
        <span className="eyebrow">404</span>
        <h1 className="display">This page was <em>never written.</em></h1>
        <Link className="btn btn-primary" href="/">Back to the story</Link>
      </div>
    </main>
  );
}
