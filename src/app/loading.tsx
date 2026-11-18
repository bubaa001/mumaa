import { Heart } from "lucide-react";

export default function Loading() {
  return (
    <main className="system" aria-busy="true">
      <div>
        <Heart className="loader-heart" fill="currentColor" strokeWidth={0} aria-hidden="true" />
        <p className="eyebrow" style={{ marginTop: 18 }}>Opening mumaa</p>
      </div>
    </main>
  );
}
