import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { withMainOfficeSuffixByLabel } from "@/lib/company-regions";
import { formatRoleWithCustom } from "../shared";

const WINDOW = 2000;

export interface IdCodesData {
  prefix: string;
  customPrefix: string;
  digits: number | null;
  startRange: number | null;
  endRange: number | null;
  nextNumber: number | null;
  remaining: number | null;
  regions: { region: string; startRange: number | null; endRange: number | null; nextNumber: number | null; remaining: number | null }[];
  mainOfficeLabel: string;
  released: { code: string; exitDate: string | null; releaseDate: string | null }[];
  assigned: Record<string, {
    name: string;
    role: string;
    customRole: string;
    isSeniorSecurity: boolean;
    regionLabel: string;
  }>;
  companyName: string;
}

type Tooltip = {
  x: number;
  y: number;
  lines: { label: string; value: string }[];
} | null;

export function IdCodesModal({
  open,
  onClose,
  loading,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  data: IdCodesData | null;
}) {
  const [query, setQuery] = useState("");
  const [windowSize, setWindowSize] = useState(WINDOW);
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const [selectedRegion, setSelectedRegion] = useState("");

  const regions = data?.regions ?? [];
  const activeRegion = selectedRegion
    ? regions.find((r) => String(r.region) === selectedRegion) ?? null
    : null;

  const prefix = data?.prefix ?? "";
  const padDigits = data?.digits ?? String(data?.endRange ?? 0).length;
  const hasRange = data?.startRange != null && data?.endRange != null;
  const viewStart = activeRegion?.startRange ?? data?.startRange ?? null;
  const viewEnd = activeRegion?.endRange ?? data?.endRange ?? null;
  const total = viewStart != null && viewEnd != null ? (viewEnd - viewStart + 1) : 0;

  const releasedByCode = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const r of data?.released ?? []) {
      if (r.code) map.set(r.code, r.releaseDate);
    }
    return map;
  }, [data]);

  const visibleNumbers = useMemo(() => {
    if (viewStart == null || viewEnd == null) return [];
    const start = viewStart;
    const end = viewEnd;
    const q = query.trim();
    const visible: number[] = [];
    const limit = q ? Infinity : windowSize;
    for (let n = start; n <= end; n += 1) {
      if (q && !String(n).includes(q)) continue;
      visible.push(n);
      if (visible.length >= limit) break;
    }
    return visible;
  }, [viewStart, viewEnd, query, windowSize]);

  function codeOf(n: number): string {
    return `${prefix}-${String(n).padStart(padDigits, "0")}`;
  }

  function handleHover(
    e: React.MouseEvent<HTMLButtonElement>,
    info: NonNullable<Tooltip>["lines"],
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: Math.min(rect.left, window.innerWidth - 320),
      y: rect.bottom + 8,
      lines: info,
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-3"
      onClick={onClose}
    >
      <div
        className="neu-card flex max-h-[88vh] rounded-lg w-full max-w-4xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">ID Numbers</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {data ? `${data.companyName} · prefix ${prefix}` : ""}
              {data && hasRange
                ? ` · ${viewStart} – ${viewEnd}`
                : ""}
              {data && data.digits != null ? ` · ${data.digits} digits` : ""}
              {data?.remaining != null ? ` · ${data.remaining} fresh remaining` : ""}
            </p>
            {!loading && data ? (
              <p className="mt-1 text-[11px] text-slate-400">
                {Object.keys(data.assigned ?? {}).length} assigned
                {releasedByCode.size > 0 ? ` · ${releasedByCode.size} in reuse pool` : ""}
                {" · faded = assigned, hover for details"}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]"
            type="button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading ID numbers...</p>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-slate-500">Unable to load ID numbers.</p>
          ) : !hasRange ? (
            <div>
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                No numeric range configured (legacy random mode). Configure a range in
                HR Policy &gt; Identity Code Settings to see the grid. Issued codes:
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(data.assigned ?? {}).map((code) => (
                  <span key={code} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <>
              {regions.length > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase text-slate-400">Region:</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedRegion(""); setQuery(""); setWindowSize(WINDOW); }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      !activeRegion
                        ? "bg-indigo-100 text-indigo-700"
                        : "neu-card text-slate-500 hover:bg-[var(--c-bg-muted)]"
                    }`}
                  >
                    All
                  </button>
                  {regions.map((region) => (
                    <button
                      key={String(region.region)}
                      type="button"
                      onClick={() => { setSelectedRegion(String(region.region)); setQuery(""); setWindowSize(WINDOW); }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        activeRegion && String(region.region) === activeRegion.region
                          ? "bg-indigo-100 text-indigo-700"
                          : "neu-card text-slate-500 hover:bg-[var(--c-bg-muted)]"
                      }`}
                      title={`${String(region.region)} · ${region.startRange ?? "?"} – ${region.endRange ?? "?"} · ${region.remaining ?? "?"} left`}
                    >
                      {String(region.region)}
                      {activeRegion && String(region.region) === activeRegion.region
                        ? ` (${region.remaining ?? "?"})`
                        : ""}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Search number (e.g. 0063)"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setWindowSize(WINDOW); }}
                  className="w-full rounded-lg neu-inset px-3 py-2 text-sm sm:w-56"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setWindowSize(WINDOW); }}
                    className="rounded-lg neu-card px-3 py-2 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
                  >
                    Clear
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Showing {visibleNumbers.length} of {total.toLocaleString("en-IN")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                {visibleNumbers.map((n) => {
                  const code = codeOf(n);
                  const holder = data.assigned?.[code];
                  const reusableFrom = releasedByCode.get(code);
                  const isReleased = reusableFrom != null;
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`rounded-md px-1 py-1.5 font-mono text-[11px] ${
                        holder
                          ? "cursor-default bg-slate-100 text-slate-400 opacity-70"
                          : isReleased
                            ? "cursor-default border border-amber-300 bg-amber-50 text-amber-700"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                      onMouseEnter={(e) => {
                        if (holder) {
                          handleHover(e, [
                            { label: "Code", value: code },
                            { label: "Name", value: holder.name || "—" },
                            {
                              label: "Role",
                              value: formatRoleWithCustom(holder.role, holder.customRole, holder.isSeniorSecurity),
                            },
                            { label: "Region/Office", value: withMainOfficeSuffixByLabel(data?.mainOfficeLabel, holder.regionLabel) || "—" },
                          ]);
                        } else if (isReleased) {
                          handleHover(e, [
                            { label: "Code", value: code },
                            {
                              label: "Status",
                              value: reusableFrom
                                ? `Reusable from ${new Date(reusableFrom).toLocaleDateString("en-IN")}`
                                : "In reuse pool",
                            },
                          ]);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (holder) {
                          handleHover(e, [
                            { label: "Code", value: code },
                            { label: "Name", value: holder.name || "—" },
                            {
                              label: "Role",
                              value: formatRoleWithCustom(holder.role, holder.customRole, holder.isSeniorSecurity),
                            },
                            { label: "Region/Office", value: withMainOfficeSuffixByLabel(data?.mainOfficeLabel, holder.regionLabel) || "—" },
                          ]);
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {String(n).padStart(padDigits, "0")}
                    </button>
                  );
                })}
              </div>

              {!query && windowSize < total ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setWindowSize(windowSize + WINDOW)}
                    className="rounded-full neu-card px-4 py-2 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
                  >
                    Show more (+{Math.min(WINDOW, total - windowSize).toLocaleString("en-IN")})
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Tooltip */}
        {tooltip ? (
          <div
            className="pointer-events-none fixed z-[120] max-w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.lines.map((line) => (
              <p key={line.label} className="text-[11px] leading-relaxed">
                <span className="font-semibold text-slate-500">{line.label}: </span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{line.value}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}