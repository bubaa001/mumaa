"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { BookOpen, CalendarDays, ChartCandlestick, Hourglass, House, Images, Lightbulb } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastProvider } from "./toast";

const navigation = [
  { label: "Home", href: "/home", icon: House },
  { label: "Memories", href: "/memories", icon: Images },
  { label: "Diary", href: "/diary", icon: BookOpen },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Ideas", href: "/ideas", icon: Lightbulb },
  { label: "Capsules", href: "/time-capsules", icon: Hourglass },
  { label: "Trading", href: "/trading", icon: ChartCandlestick },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MummaaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The tapped section lights up immediately, before the new page has arrived.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const current = pending ?? pathname;
  const go = (href: string) => () => {
    if (!isActive(pathname, href)) setPending(href);
  };
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (value) => setScrolled(value > 8));

  return (
    <div className="app">
      <header className="app-header" data-scrolled={scrolled}>
        <div className="app-header-inner">
          <Link className="wordmark" href="/home">mumaa<b>.</b></Link>
          <nav className="app-nav" aria-label="Primary">
            {navigation.map((item) => {
              const active = isActive(current, item.href);
              return (
                <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href} onClick={go(item.href)}>
                  {active && (
                    <motion.span
                      className="app-nav-pill"
                      layoutId="nav-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <form action="/api/auth/logout" method="post">
            <button className="btn btn-ghost leave-btn" type="submit">Leave</button>
          </form>
        </div>
      </header>

      <div className="nav-progress" data-active={pending !== null} aria-hidden="true" />

      <ToastProvider>
        <main className="app-main page-enter" key={pathname}>
          {children}
        </main>
      </ToastProvider>

      <nav className="tabbar" aria-label="Sections">
        {navigation.map((item) => {
          const active = isActive(current, item.href);
          const Icon = item.icon;
          return (
            <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href} onClick={go(item.href)}>
              {active && (
                <motion.span
                  className="tabbar-pill"
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
}) {
  const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as React.CSSProperties;
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow enter" style={delay(0.05)}>{eyebrow}</span>
        <h1 className="display enter" style={delay(0.12)}>{title}</h1>
        {description && <p className="enter" style={delay(0.2)}>{description}</p>}
      </div>
      {children && <div className="page-head-side enter" style={delay(0.28)}>{children}</div>}
    </header>
  );
}
