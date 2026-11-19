"use client";

import { useRef } from "react";
import { gsap, hasFinePointer, prefersReducedMotion, useGSAP } from "./gsap";

/** Tips a card toward the cursor in 3D and moves a soft highlight with it. */
export function Tilt({ children, max = 7 }: { children: React.ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const element = ref.current;
      if (!element || !contextSafe || !hasFinePointer() || prefersReducedMotion()) return;
      gsap.set(element, { transformPerspective: 900 });
      const rx = gsap.quickTo(element, "rotationX", { duration: 0.6, ease: "power3.out" });
      const ry = gsap.quickTo(element, "rotationY", { duration: 0.6, ease: "power3.out" });

      const move = contextSafe((event: PointerEvent) => {
        const box = element.getBoundingClientRect();
        const px = (event.clientX - box.left) / box.width;
        const py = (event.clientY - box.top) / box.height;
        ry((px - 0.5) * max * 2);
        rx((0.5 - py) * max * 2);
        element.style.setProperty("--mx", `${px * 100}%`);
        element.style.setProperty("--my", `${py * 100}%`);
      });
      const leave = contextSafe(() => {
        rx(0);
        ry(0);
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
    <div ref={ref} className="tilt">
      {children}
    </div>
  );
}
