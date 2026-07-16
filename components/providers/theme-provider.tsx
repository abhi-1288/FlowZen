"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { deriveThemeTokens } from "@/lib/theme";

const LS_KEY = "flowzen_companyColor";
export const THEME_KEY = "flowzen_theme";
export type ThemePreference = "light" | "dark" | "system";

export function getThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    // Migrate the old boolean preference.
    if (localStorage.getItem("flowzen_darkMode") === "true") return "dark";
  } catch {}
  return "system";
}

export function applyTheme(preference: ThemePreference) {
  const isDark = preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function getPersistedColor(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const tokens = useMemo(() => {
    const cached = getPersistedColor();
    const color = cached || session?.user?.companyColor;
    if (!color) return null;
    return deriveThemeTokens(color);
  }, [session?.user?.companyColor]);

  useEffect(() => {
    const preference = getThemePreference();
    applyTheme(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (getThemePreference() === "system") applyTheme("system"); };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!tokens) return;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(tokens)) {
      root.style.setProperty(`--color-${key}`, value);
    }
  }, [tokens]);

  return <>{children}</>;
}
