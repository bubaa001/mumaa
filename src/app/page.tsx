import { FadeIn, MummaaShell } from "@/components/mumaa-shell";

const modules = [
  ["Diary", "Write something worth returning to.", "/diary"],
  ["Memories", "Keep the moments that shaped you.", "/memories"],
  ["Events", "Make room for what comes next.", "/events"],
  ["Ideas", "Build the future together.", "/ideas"],
];

export default function HomePage() {
  return (
    <MummaaShell>
      <FadeIn>
        <section className="border-b border-mumaa-navy/10 bg-mumaa-navy px-5 py-16 text-white sm:px-10 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="mb-5 text-[10px] font-bold tracking-[0.26em] text-mumaa-gold uppercase">
              Your shared space
            </p>
            <h1 className="max-w-3xl font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
              A private world
              <br />
              <em className="text-mumaa-silver">for two.</em>
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-mumaa-silver">
              A quiet place for the things you are building, remembering, and becoming together.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-5 py-12 sm:px-10 sm:py-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-mumaa-blue uppercase">
                Begin here
              </p>
              <h2 className="mt-3 font-display text-4xl text-mumaa-navy sm:text-5xl">
                Make it yours.
              </h2>
            </div>
            <span className="hidden text-sm text-mumaa-blue sm:block">No shared activity yet</span>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {modules.map(([title, description, href]) => (
              <a
                className="group rounded-2xl border border-mumaa-navy/10 bg-white/60 p-6 transition hover:-translate-y-0.5 hover:border-mumaa-gold hover:bg-white"
                href={href}
                key={title}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-2xl text-mumaa-navy">{title}</h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-mumaa-blue">{description}</p>
                  </div>
                  <span className="text-xl text-mumaa-gold transition-transform group-hover:translate-x-1">
                    ↗
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </FadeIn>
    </MummaaShell>
  );
}
