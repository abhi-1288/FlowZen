"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { Building2, Globe, Mail, MapPin, Calendar, FileText } from "lucide-react";

type PortfolioData = {
  name: string | null;
  icon: string | null;
  primaryColor: string;
  slug: string | null;
  tagline: string | null;
  about: string | null;
  mission: string | null;
  address: string | null;
  addresses: { label?: string; line1?: string; city?: string; state?: string; zip?: string; country?: string; isMain?: boolean }[];
  multiOffice: boolean;
  website: string | null;
  supportEmail: string | null;
  startDate: string | null;
  requiredDocuments: { name: string; mandatory?: boolean; acceptedFileTypes?: string[] }[];
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "C";
}

function darkenColor(hex: string, factor = 0.82): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n * factor).toString(16).padStart(2, "0")).join("")}`;
}

function formatAddress(addr: PortfolioData["addresses"][0]): string {
  const parts = [addr.line1, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
  return parts.join(", ");
}

export default function ProfilesPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const slug = getCookie("x-company-slug");
    if (!slug) {
      setError("No company subdomain detected. Please visit this page from your company's subdomain.");
      setLoading(false);
      return;
    }

    apiFetch<PortfolioData>(`/api/public/company-portfolio/${encodeURIComponent(slug)}`)
      .then(setData)
      .catch((err: Error) => setError(err.message || "Company not found."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--c-bg)] p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">Company Profile</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Public company information</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="neu-card rounded-2xl p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 dark:border-zinc-700"
              style={{ borderTopColor: "#2563eb" }}
            />
            <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">Loading profile...</p>
          </div>
        )}

        {/* Error */}
        {error && !data && (
          <div className="neu-card rounded-2xl border-2 border-rose-200 p-8 text-center dark:border-rose-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950">
              <Building2 size={28} className="text-rose-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-zinc-200">Company Not Found</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{error}</p>
          </div>
        )}

        {/* Portfolio card */}
        {data && (
          <div className="neu-card overflow-hidden rounded-2xl">
            {/* Hero banner */}
            <div
              className="relative px-6 py-8 text-center"
              style={{ background: `linear-gradient(135deg, ${data.primaryColor}, ${darkenColor(data.primaryColor)})` }}
            >
              {data.icon ? (
                <img
                  src={data.icon}
                  alt={data.name || "Company"}
                  className="mx-auto h-16 w-16 rounded-2xl border-3 border-white/30 object-cover shadow-lg"
                />
              ) : (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-3 border-white/30 bg-white/20 text-2xl font-bold text-white shadow-lg">
                  {data.name ? getInitials(data.name) : "C"}
                </div>
              )}
              <h2 className="mt-4 text-xl font-bold text-white drop-shadow">{data.name}</h2>
              {data.tagline && (
                <p className="mt-1.5 text-sm italic text-white/85">{data.tagline}</p>
              )}
              {data.slug && (
                <p className="mt-1 text-xs text-white/60">{data.slug}</p>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* About */}
              {data.about && (
                <div className="rounded-lg neu-inset px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">About</p>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-line">{data.about}</p>
                </div>
              )}

              {/* Mission */}
              {data.mission && (
                <div className="rounded-lg neu-inset px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Our Mission</p>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300 italic whitespace-pre-line">{data.mission}</p>
                </div>
              )}

              {/* Website */}
              {data.website && (
                <div className="flex items-center gap-3 rounded-lg neu-inset px-4 py-3">
                  <Globe size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Website</p>
                    <a
                      href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-sm font-medium hover:underline"
                      style={{ color: data.primaryColor }}
                    >
                      {data.website}
                    </a>
                  </div>
                </div>
              )}

              {/* Support Email */}
              {data.supportEmail && (
                <div className="flex items-center gap-3 rounded-lg neu-inset px-4 py-3">
                  <Mail size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Support</p>
                    <a
                      href={`mailto:${data.supportEmail}`}
                      className="mt-0.5 block truncate text-sm font-medium hover:underline"
                      style={{ color: data.primaryColor }}
                    >
                      {data.supportEmail}
                    </a>
                  </div>
                </div>
              )}

              {/* Established */}
              {data.startDate && (
                <div className="flex items-center gap-3 rounded-lg neu-inset px-4 py-3">
                  <Calendar size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Established</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-100">{formatDate(data.startDate)}</p>
                  </div>
                </div>
              )}

              {/* Offices */}
              {data.multiOffice && data.addresses.length > 0 && (
                <div className="rounded-lg neu-inset px-4 py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Office Locations</p>
                  </div>
                  <div className="space-y-2">
                    {data.addresses.map((addr, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {addr.isMain && (
                          <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: data.primaryColor }} />
                        )}
                        <div>
                          {addr.label && <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{addr.label}</p>}
                          <p className="text-xs text-slate-500 dark:text-zinc-400">{formatAddress(addr)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single address (when not multi-office) */}
              {!data.multiOffice && data.address && (
                <div className="flex items-center gap-3 rounded-lg neu-inset px-4 py-3">
                  <MapPin size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Address</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-100">{data.address}</p>
                  </div>
                </div>
              )}

              {/* Required Documents */}
              {data.requiredDocuments.length > 0 && (
                <div className="rounded-lg neu-inset px-4 py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Required Documents</p>
                  </div>
                  <div className="space-y-1.5">
                    {data.requiredDocuments.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-zinc-300">{doc.name}</span>
                        {doc.mandatory && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                            Required
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--c-border-light)] px-6 py-4 text-center dark:border-zinc-800">
              <p className="text-[10px] text-slate-300 dark:text-zinc-600">Powered by FlowZen</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
