import { createLocalStore } from "@/lib/local-store";
import { THEME_KEY } from "@/lib/theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const themeStore = createLocalStore<ThemePreference>(THEME_KEY, "system", {
  serialize: (value) => value,
  deserialize: (raw) => (raw === "light" || raw === "dark" || raw === "system" ? raw : null),
});

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function resolveTheme(preference: ThemePreference): Theme {
  if (preference === "system") return darkQuery().matches ? "dark" : "light";
  return preference;
}

/** Stamps the resolved theme on <html>, cross-fading when the browser supports view transitions. */
export function applyTheme(preference: ThemePreference, animate = false) {
  const root = document.documentElement;
  const theme = resolveTheme(preference);
  if (root.dataset.theme === theme) return;
  const update = () => {
    root.dataset.theme = theme;
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (animate && !reduceMotion && "startViewTransition" in document) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

export function onSystemThemeChange(callback: () => void): () => void {
  const query = darkQuery();
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
