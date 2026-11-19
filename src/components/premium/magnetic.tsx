"use client";

import { useRef } from "react";
import { gsap, hasFinePointer, prefersReducedMotion, useGSAP } from "./gsap";

/** Pulls its child gently toward the cursor and springs back on leave. */
export function Magnetic({ children, strength = 0.32 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const element = ref.current;
      if (!element || !contextSafe || !hasFinePointer() || prefersReducedMotion()) return;
      const xTo = gsap.quickTo(element, "x", { duration: 0.7, ease: "elastic.out(1, 0.45)" });
      const yTo = gsap.quickTo(element, "y", { duration: 0.7, ease: "elastic.out(1, 0.45)" });

      const move = contextSafe((event: PointerEvent) => {
        const box = element.getBoundingClientRect();
        xTo((event.clientX - (box.left + box.width / 2)) * strength);
        yTo((event.clientY - (box.top + box.height / 2)) * strength);
      });
      const leave = contextSafe(() => {
        xTo(0);
        yTo(0);
      });

      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", leave);
      return () => {
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className="magnetic">
      {children}
    </span>
  );
}
