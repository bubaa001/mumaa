"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { createElement, useLayoutEffect, useRef } from "react";

export const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Content is always rendered visible on the server, so nothing is hidden while
 * JavaScript loads. After hydration, anything still below the fold is tucked
 * away and eased in as it scrolls into view.
 */
function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.reveal = "shown";
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/** Fades and lifts content into place the first time it enters the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "article" | "li" | "header";
}) {
  const ref = useScrollReveal<HTMLElement>();
  return createElement(
    as,
    {
      ref,
      className: `reveal ${className ?? ""}`,
      style: { "--d": `${delay}s`, "--y": `${y}px` } as React.CSSProperties,
    },
    children,
  );
}

/** Staggers its direct children as the group scrolls into view. */
export function RevealGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal-group ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/** Each word brightens as the paragraph is scrolled through, like reading it aloud. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");

  if (reduce) return <p className={className}>{text}</p>;
  const classes = `scroll-words ${className ?? ""}`;

  return (
    <p className={classes} ref={ref} aria-label={text}>
      {words.map((word, index) => (
        <Word key={`${word}-${index}`} progress={scrollYProgress} range={[index / words.length, (index + 1) / words.length]}>
          {word}
        </Word>
      ))}
    </p>
  );
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span aria-hidden="true" style={{ opacity }}>
      {children}
    </motion.span>
  );
}
