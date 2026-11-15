import Link from "next/link";
import { MummaaShell } from "@/components/mumaa-shell";

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <MummaaShell>
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-10 sm:py-24">
        <p className="text-[10px] font-bold tracking-[0.24em] text-mumaa-blue uppercase">{eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight text-mumaa-navy">{title}</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-mumaa-navy/20 bg-white/40 p-8">
          <p className="max-w-md text-sm leading-7 text-mumaa-blue">{description}</p>
          <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-mumaa-navy uppercase">
            Nothing here yet
          </p>
        </div>
        <Link className="mt-8 inline-block text-sm font-semibold text-mumaa-blue underline underline-offset-4" href="/">
          Return home
        </Link>
      </section>
    </MummaaShell>
  );
}
