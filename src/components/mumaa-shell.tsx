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
    <div className={`min-h-screen ${pathname === "/home" ? "home-shell" : "bg-mumaa-ivory"}`}>
      <header className={`shell-header ${pathname === "/home" ? "shell-header-home" : "border-b border-mumaa-navy/10 bg-mumaa-ivory/90 backdrop-blur"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link className="font-display text-2xl italic tracking-tight text-mumaa-navy" href="/home">
            <img className="mumaa-logo mumaa-logo-shell" src="/images/mumaa-logo.png" alt="Mumaa" />
          </Link>
          <span className={`hidden text-[10px] font-semibold tracking-[0.2em] uppercase sm:block ${pathname === "/home" ? "home-shell-muted" : "text-mumaa-blue"}`}>
            A private world for two
          </span>
          <nav className="shell-desktop-nav" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link className={pathname === item.href ? "shell-nav-active" : ""} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/logout" method="post">
            <button
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${pathname === "/home" ? "home-shell-action" : "border-mumaa-navy/15 text-mumaa-navy hover:bg-mumaa-navy hover:text-mumaa-ivory"}`}
              type="submit"
            >
              Leave
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl">
        <main className="min-w-0 flex-1 pb-24">{children}</main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className={`fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 px-2 py-2 backdrop-blur lg:hidden ${pathname === "/home" ? "home-shell-mobile" : "border-t border-mumaa-navy/10 bg-mumaa-ivory/95"}`}
      >
        {navigation.slice(0, 4).map((item) => (
          <Link
            className={`rounded-lg px-2 py-2 text-center text-[11px] ${
              pathname === item.href ? pathname === "/home" ? "font-bold text-white" : "font-bold text-mumaa-navy" : pathname === "/home" ? "text-white/55" : "text-mumaa-blue"
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
