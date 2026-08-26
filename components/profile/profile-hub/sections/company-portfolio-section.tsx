"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { BookOpen } from "lucide-react";
import type { AnyRecord } from "../shared";

export function CompanyPortfolioSection({
  company,
  showToast,
}: {
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [tagline, setTagline] = useState(company?.tagline ? String(company.tagline) : "");
  const [about, setAbout] = useState(company?.about ? String(company.about) : "");
  const [mission, setMission] = useState(company?.mission ? String(company.mission) : "");
  const [saving, setSaving] = useState(false);

  const origTagline = company?.tagline ? String(company.tagline) : "";
  const origAbout = company?.about ? String(company.about) : "";
  const origMission = company?.mission ? String(company.mission) : "";

  const hasChanged = tagline !== origTagline || about !== origAbout || mission !== origMission;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/company/portfolio", {
        method: "PATCH",
        body: JSON.stringify({ tagline, about, mission }),
      });
      showToast("Portfolio updated successfully", "success");
    } catch {
      showToast("Failed to update portfolio", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl neu-card p-5 dark:bg-[#000000] dark:border-zinc-800">
      <div className="mb-5 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Company Portfolio</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
          Manage your public company profile visible on the subdomain portfolio page.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <BookOpen size={14} /> Tagline
          </label>
          <input
            type="text"
            className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
            placeholder="Innovation meets excellence"
            value={tagline}
            maxLength={150}
            onChange={(e) => setTagline(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">{tagline.length}/150</p>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            About
          </label>
          <textarea
            className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
            rows={4}
            placeholder="Tell visitors what your company does, its history, and what makes it unique..."
            value={about}
            maxLength={2000}
            onChange={(e) => setAbout(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">{about.length}/2000</p>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Mission Statement
          </label>
          <textarea
            className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
            rows={3}
            placeholder="Our mission is to..."
            value={mission}
            maxLength={1000}
            onChange={(e) => setMission(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">{mission.length}/1000</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end border-t border-[var(--c-border-light)] pt-4 dark:border-zinc-800/50">
        <button
          type="button"
          disabled={saving || !hasChanged}
          onClick={handleSave}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Portfolio"}
        </button>
      </div>
    </section>
  );
}
