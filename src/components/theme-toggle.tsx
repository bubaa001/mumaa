"use client";

import { AnimatePresence, motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, THEME_KEY, type ThemeChoice } from "@/lib/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<ThemeChoice, string> = { auto: "Auto", light: "Light", dark: "Dark" };
const ICON = { auto: Monitor, light: Sun, dark: Moon } as const;

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

/**
 * One button that steps Auto → Light → Dark. Auto follows the device and keeps following it if the
 * device switches (for example at sunset); the choice is remembered on this device.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => setChoice(readChoice()), []);

  // While on Auto, follow the device's own setting as it changes.
  useEffect(() => {
    if (choice !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, [choice]);

  const step = () => {
    const next = NEXT[choice ?? "auto"];
    setChoice(next);
    try {
      if (next === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch { /* private mode: still switch for this visit */ }
    document.documentElement.classList.add("theme-switching");
    applyTheme(resolveTheme(next));
    window.setTimeout(() => document.documentElement.classList.remove("theme-switching"), 400);
  };

  const shown = choice ?? "auto";
  const Icon = ICON[shown];
  return (
    <button type="button" className="theme-toggle" onClick={step}
      aria-label={`Theme: ${LABEL[shown]}. Switch to ${LABEL[NEXT[shown]]}`} title={`Theme: ${LABEL[shown]}`}>
      <AnimatePresence mode="wait" initial={false}>
        {/* Until the saved choice is read, show no icon rather than a wrong one. */}
        {choice === null ? <span key="none" className="theme-toggle-icon" /> : <motion.span key={shown} className="theme-toggle-icon"
          initial={{ opacity: 0, rotate: -60, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 60, scale: 0.6 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
          <Icon aria-hidden="true" />
        </motion.span>}
      </AnimatePresence>
      <span className="theme-toggle-label">{choice ? LABEL[shown] : " "}</span>
    </button>
  );
}
