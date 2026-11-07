"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Monitor, Sparkles } from "lucide-react";
import { applyTheme, getThemePreference, THEME_KEY, type ThemePreference, getGlassPreference, applyGlass } from "@/components/providers/theme-provider";

export function AppearanceSection() {
  const [mode, setMode] = useState<ThemePreference>("system");
  const [glass, setGlass] = useState(false);

  useEffect(() => {
    setMode(getThemePreference());
    const g = getGlassPreference();
    setGlass(g);
    applyGlass(g);
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
        next === "dark" || next === "dark-neumorphism" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ));
    } catch { }
  }, []);

  const handleSelect = useCallback((newMode: ThemePreference) => {
    setMode(newMode);
    applyMode(newMode);
  }, [applyMode]);

  const options: { value: ThemePreference; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: "light", label: "Light", icon: <Sun size={18} />, desc: "White background" },
    { value: "dark", label: "Dark", icon: <Moon size={18} />, desc: "AMOLED black" },
    { value: "system", label: "System", icon: <Monitor size={18} />, desc: "Follow OS" },
    { value: "light-neumorphism", label: "Light Neumorphism", icon: <Sparkles size={18} />, desc: "Soft raised surfaces" },
    { value: "dark-neumorphism", label: "Dark Neumorphism", icon: <Sparkles size={18} />, desc: "Soft dark surfaces" },
  ];

  return (
    <section className="rounded-xl neu-card p-5 my-5 dark:border-zinc-800 dark:bg-[#000000]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Interface theme</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
          Choose how FlowZen follows your display.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {options.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-center transition-all duration-150 ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300" : "border-[var(--c-border-light)] bg-[var(--c-bg-slate-100 dark:bg-zinc-800)] text-slate-600 hover:border-slate-300 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] dark:border-zinc-700 dark:bg-[#000000] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"}`}
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

      <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">Glassmorphism UI</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Frosted translucent surfaces on headers and cards.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={glass}
          onClick={() => { const next = !glass; setGlass(next); applyGlass(next); }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${glass ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-600"}`}
        >
          <span
            className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${glass ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
    </section>
  );
}
