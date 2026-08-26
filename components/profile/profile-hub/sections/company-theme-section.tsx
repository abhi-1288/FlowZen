"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/client-utils";
import { COMPANY_PALETTE, deriveThemeTokens } from "@/lib/theme";
import { isValidSlug } from "@/lib/slug-shared";
import { Globe, Link as LinkIcon, Mail, AlertTriangle } from "lucide-react";
import type { AnyRecord } from "../shared";

export function CompanyThemeSection({
  company,
  showToast,
}: {
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const currentColor = company?.primaryColor ? String(company.primaryColor) : "#2563eb";
  const [selected, setSelected] = useState(currentColor);
  const [saving, setSaving] = useState(false);
  const [previewTokens, setPreviewTokens] = useState(() => deriveThemeTokens(currentColor));

  const [supportEmail, setSupportEmail] = useState(company?.supportEmail ? String(company.supportEmail) : "");
  const [website, setWebsite] = useState(company?.website ? String(company.website) : "");

  const currentSlug = company?.slug ? String(company.slug) : "";
  const [slug, setSlug] = useState(currentSlug);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    setPreviewTokens(deriveThemeTokens(selected));
  }, [selected]);

  const colorChanged = selected !== currentColor;

  const hasSettingsChanged = () => {
    const origEmail = company?.supportEmail ? String(company.supportEmail) : "";
    const origWebsite = company?.website ? String(company.website) : "";
    if (supportEmail !== origEmail) return true;
    if (website !== origWebsite) return true;
    return false;
  };

  const baseDomain = typeof window !== "undefined"
    ? (window.location.hostname.replace(/^[^.]+\./, "") || window.location.hostname)
    : "localhost";

  const slugChanged = slug.trim() !== currentSlug;
  const slugValid = isValidSlug(slug.trim());
  const slugErrorText = slug.trim() && !slugValid
    ? "2-40 chars, lowercase letters, numbers, and hyphens only."
    : "";

  const handleSlugSave = async () => {
    const trimmed = slug.trim().toLowerCase();
    if (!slugValid || trimmed === currentSlug) return;
    setSlugSaving(true);
    setSlugError("");
    try {
      const data = await apiFetch<{ slug: string }>("/api/company/slug", {
        method: "PATCH",
        body: JSON.stringify({ slug: trimmed }),
      });
      setSlug(data.slug);
      showToast("Subdomain updated successfully", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update subdomain.";
      setSlugError(msg);
      showToast(msg, "error");
    } finally {
      setSlugSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const colorChangedLocally = selected !== currentColor;
      const settingsChanged = hasSettingsChanged();

      if (colorChangedLocally) {
        await apiFetch("/api/company/theme", {
          method: "PATCH",
          body: JSON.stringify({
            primaryColor: selected,
            ...(settingsChanged ? { supportEmail, website } : {}),
          }),
        });
        const tokens = deriveThemeTokens(selected);
        const root = document.documentElement;
        for (const [key, value] of Object.entries(tokens)) {
          root.style.setProperty(`--color-${key}`, value);
        }
        try { localStorage.setItem("flowzen_companyColor", selected); } catch {}
      }

      if (settingsChanged && !colorChangedLocally) {
        await apiFetch("/api/company/theme", {
          method: "PATCH",
          body: JSON.stringify({ supportEmail, website }),
        });
      }

      showToast("Settings saved successfully", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl neu-card p-5 dark:bg-[#000000] dark:border-zinc-800">
      <div className="mb-5 border-l-4 pl-4" style={{ borderColor: previewTokens.primary }}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Company Theme</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
          Choose an accent colour and contact info.
        </p>
      </div>

      {/* Color palette */}
      <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
        {COMPANY_PALETTE.map(({ name, hex }) => {
          const isActive = selected === hex;
          return (
            <button
              key={hex}
              type="button"
              title={name}
              onClick={() => setSelected(hex)}
              className="relative flex items-center justify-center rounded-xl p-3 transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: hex,
                width: 44,
                height: 44,
              }}
            >
              {isActive && (
                <svg className="h-5 w-5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Live preview */}
      <div className="mt-6 flex items-center gap-4 rounded-xl p-4" style={{ backgroundColor: previewTokens["primary-bg"] }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: previewTokens.primary }}>
          A
        </div>
        <div className="flex-1">
          <div className="h-2 w-24 rounded-full" style={{ backgroundColor: previewTokens.primary }} />
          <div className="mt-1.5 h-2 w-32 rounded-full" style={{ backgroundColor: previewTokens["primary-light"] }} />
        </div>
        <button
          type="button"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: previewTokens.primary }}
        >
          Preview
        </button>
      </div>

      {/* Contact section */}
      <div className="mt-6 space-y-5 border-t border-[var(--c-border-light)] pt-5 dark:border-zinc-800/50">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Contact</h4>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <Mail size={14} /> Support Email
          </label>
          <input
            type="email"
            className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
            placeholder="support@company.com"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            <Globe size={14} /> Website
          </label>
          <input
            type="text"
            className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
            placeholder="www.company.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      {/* Subdomain section */}
      <div className="mt-6 space-y-4 border-t border-[var(--c-border-light)] pt-5 dark:border-zinc-800/50">
        <div className="flex items-center gap-2">
          <LinkIcon size={14} className="text-slate-500 dark:text-zinc-400" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Subdomain</h4>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Company Subdomain
          </label>
          <div className="flex items-center gap-0 rounded-lg overflow-hidden neu-inset">
            <input
              type="text"
              className="min-w-0 flex-1 border-r border-[var(--c-border-light)] bg-transparent px-3 py-2 text-sm dark:border-zinc-700 dark:text-zinc-100"
              placeholder="my-company"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugError(""); }}
            />
            <span className="shrink-0 px-3 py-2 text-sm text-slate-400 dark:text-zinc-500 whitespace-nowrap">
              .{baseDomain}
            </span>
          </div>
          {(slugErrorText || slugError) && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-500">
              <AlertTriangle size={12} />
              {slugError || slugErrorText}
            </p>
          )}
          {slugChanged && slugValid && !slugError && (
            <p className="mt-1.5 text-xs text-amber-500">
              Changing the subdomain will update your company URL. Previous links will stop working.
            </p>
          )}
        </div>

        {slugChanged && slugValid && (
          <button
            type="button"
            disabled={slugSaving}
            onClick={handleSlugSave}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {slugSaving ? "Updating..." : "Update Subdomain"}
          </button>
        )}
      </div>

      {/* Save / Reset */}
      <div className="mt-5 flex items-center justify-end gap-3 border-t border-[var(--c-border-light)] pt-4 dark:border-zinc-800/50">
        {colorChanged && (
          <button
            type="button"
            onClick={() => setSelected(currentColor)}
            className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-[var(--c-bg-muted)] dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Reset Color
          </button>
        )}
        <button
          type="button"
          disabled={saving || (!colorChanged && !hasSettingsChanged())}
          onClick={handleSave}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: previewTokens.primary }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
