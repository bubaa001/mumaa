/**
 * Light / dark theme. The choice ("auto", "light" or "dark") lives in localStorage on each device;
 * "auto" follows the phone or computer's own setting. The resolved theme is written to
 * <html data-theme="…"> by THEME_SCRIPT, which runs in <head> before anything is drawn, so a dark
 * page never flashes white first. All colours come from CSS tokens in globals.css that switch on it.
 */
export type ThemeChoice = "auto" | "light" | "dark";
export const THEME_KEY = "mumaa.theme";
export const THEME_BAR = { light: "#f5efe6", dark: "#16110f" } as const;

/** Resolve a choice against the system setting. */
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "auto") return choice;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Put the theme on the page: the data attribute, native controls, and the browser bar colour. */
export function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_BAR[theme]));
}

/** Same as resolveTheme + applyTheme, inlined into <head> (no imports available there). */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=c==="dark"||(c!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
