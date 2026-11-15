"use client";

export default function Error({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-mumaa-ivory px-6 text-center">
      <div>
        <p className="mb-3 text-xs font-bold tracking-[0.24em] text-mumaa-blue uppercase">
          MUMAA
        </p>
        <h1 className="font-display text-4xl text-mumaa-navy">
          Something needs a second look.
        </h1>
        <button
          className="mt-8 rounded-full bg-mumaa-navy px-5 py-3 text-sm font-semibold text-white"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
