"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { BookOpen, CalendarDays, Hourglass, House, Images, Lightbulb } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ease } from "./motion";

const navigation = [
  { label: "Home", href: "/home", icon: House },
  { label: "Memories", href: "/memories", icon: Images },
  { label: "Diary", href: "/diary", icon: BookOpen },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Ideas", href: "/ideas", icon: Lightbulb },
  { label: "Capsules", href: "/time-capsules", icon: Hourglass },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MummaaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
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
              const active = isActive(pathname, item.href);
              return (
                <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href}>
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

      <motion.main
        className="app-main"
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
      >
        {children}
      </motion.main>

      <nav className="tabbar" aria-label="Sections">
        {navigation.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href}>
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
  const reduce = useReducedMotion();
  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease, delay },
  });
  return (
    <header className="page-head">
      <div>
        <motion.span className="eyebrow" {...enter(0.05)}>{eyebrow}</motion.span>
        <motion.h1 className="display" {...enter(0.12)}>{title}</motion.h1>
        {description && <motion.p {...enter(0.2)}>{description}</motion.p>}
      </div>
      {children && <motion.div className="page-head-side" {...enter(0.28)}>{children}</motion.div>}
    </header>
  );
}
