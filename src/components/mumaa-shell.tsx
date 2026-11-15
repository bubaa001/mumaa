"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Home", href: "/home" },
  { label: "Diary", href: "/diary" },
  { label: "Memories", href: "/memories" },
  { label: "Events", href: "/events" },
  { label: "Ideas", href: "/ideas" },
  { label: "Capsules", href: "/time-capsules" },
];

export function MummaaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-mumaa-ivory">
      <header className="border-b border-mumaa-navy/10 bg-mumaa-ivory/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link className="font-display text-2xl italic tracking-tight text-mumaa-navy" href="/home">
            <img className="mumaa-logo mumaa-logo-shell" src="/images/mumaa-logo.png" alt="Mumaa" />
          </Link>
          <span className="hidden text-[10px] font-semibold tracking-[0.2em] text-mumaa-blue uppercase sm:block">
            A private world for two
          </span>
          <Link
            className="rounded-full border border-mumaa-navy/15 px-3 py-2 text-xs font-semibold text-mumaa-navy"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden min-h-[calc(100vh-81px)] w-56 shrink-0 border-r border-mumaa-navy/10 px-5 py-8 lg:block">
          <nav aria-label="Primary navigation" className="space-y-1">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  className={`block rounded-xl px-4 py-3 text-sm transition ${
                    active
                      ? "bg-mumaa-navy text-white"
                      : "text-mumaa-blue hover:bg-mumaa-navy/5"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-24">{children}</main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-mumaa-navy/10 bg-mumaa-ivory/95 px-2 py-2 backdrop-blur lg:hidden"
      >
        {navigation.slice(0, 4).map((item) => (
          <Link
            className={`rounded-lg px-2 py-2 text-center text-[11px] ${
              pathname === item.href ? "font-bold text-mumaa-navy" : "text-mumaa-blue"
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
