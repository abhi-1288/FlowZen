"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/client-utils";
import { COMPANY_PALETTE, deriveThemeTokens } from "@/lib/theme";
import { Globe, Mail } from "lucide-react";
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 pl-4" style={{ borderColor: previewTokens.primary }}>
        <h3 className="text-base font-semibold text-slate-900">Company Theme</h3>
        <p className="mt-0.5 text-sm text-slate-500">
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
      <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-700">Contact</h4>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Mail size={14} /> Support Email
          </label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="support@company.com"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Globe size={14} /> Website
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="www.company.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      {/* Save / Reset */}
      <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {colorChanged && (
          <button
            type="button"
            onClick={() => setSelected(currentColor)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
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
