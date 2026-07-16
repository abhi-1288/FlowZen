"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { applyTheme, getThemePreference, THEME_KEY, type ThemePreference } from "@/components/providers/theme-provider";

export function AppearanceSection() {
  const [mode, setMode] = useState<ThemePreference>("system");

  useEffect(() => {
    setMode(getThemePreference());
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyMode("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const applyMode = useCallback((next: ThemePreference) => {
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
      localStorage.setItem("flowzen_darkMode", String(
        next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ));
    } catch {}
  }, []);

  const handleSelect = useCallback((newMode: ThemePreference) => {
    setMode(newMode);
    applyMode(newMode);
  }, [applyMode]);

  const options: { value: ThemePreference; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: "light", label: "Light", icon: <Sun size={18} />, desc: "White background" },
    { value: "dark", label: "Dark", icon: <Moon size={18} />, desc: "AMOLED black" },
    { value: "system", label: "System", icon: <Monitor size={18} />, desc: "Follow OS" },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#000000]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Interface theme</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
          Choose how FlowZen follows your display.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-center transition-all duration-150 ${
                active
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-[#000000] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
              }`}
            >
              <span className={`transition-colors ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-500"}`}>
                {opt.icon}
              </span>
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
