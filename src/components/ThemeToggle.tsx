"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

const KEY = "agent-relay:theme";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL: Record<Theme, string> = {
  system: "Theme: follows your system",
  light: "Theme: light",
  dark: "Theme: dark",
};

/**
 * Three-state theme control. System is the default and the app looks right without ever
 * touching this — the toggle only exists for people who want to override it.
 */
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("system");

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* storage disabled */
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    try {
      if (next === "system") {
        window.localStorage.removeItem(KEY);
        document.documentElement.removeAttribute("data-theme");
      } else {
        window.localStorage.setItem(KEY, next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {
      /* storage disabled — the attribute still applies for this page view */
    }
  }

  const Icon = ICON[theme];

  return (
    <button
      type="button"
      onClick={() => apply(NEXT[theme])}
      title={LABEL[theme]}
      aria-label={`${LABEL[theme]}. Activate to switch to ${NEXT[theme]}.`}
      className="rounded-md p-1.5 text-fg-faint transition-colors hover:bg-bg-inset hover:text-fg"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
