"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { ATSCandidate } from "@/lib/recruitment-types";
import { STAGE_LABELS } from "@/lib/recruitment-types";

type RegionOption = {
  label: string;
  displayLabel: string;
  hrHeadName: string;
  adminHeadName: string;
  hrCount: number;
  adminCount: number;
  eligible: boolean;
};

type DistributeResult = {
  moved: number;
  unchanged: number;
  skipped: number;
  notVisible: number;
  region: string;
  regionLabel: string;
  regionHasApprover: boolean;
};

function isEligibleForDistribution(c: ATSCandidate): boolean {
  if (c.stage === "offer" || c.stage === "joined") return true;
  if (c.atsStatus === "selected") return true;
  if (c.assessmentStatus === "selected") return true;
  return false;
}

export function DistributeCandidateModal({
  jobId,
  candidates,
  onClose,
  onDone,
}: {
  jobId: string;
  candidates: ATSCandidate[];
  onClose: () => void;
  onDone: (result: DistributeResult) => void;
}) {
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const eligibleCandidates = useMemo(
    () => candidates.filter(isEligibleForDistribution),
    [candidates],
  );

  const candidateStates = useMemo(
    () => [...new Set(eligibleCandidates.map((c) => String(c.regionLabel || "").trim()).filter(Boolean))],
    [eligibleCandidates],
  );

  const filteredCandidates = useMemo(() => {
    if (!stateFilter) return eligibleCandidates;
    return eligibleCandidates.filter((c) => String(c.regionLabel || "") === stateFilter);
  }, [eligibleCandidates, stateFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recruitment/jobs/${jobId}/bulk-region`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load regions");
        const data = await res.json();
        if (cancelled) return;
        setRegions(Array.isArray(data.regions) ? data.regions : []);
      } catch {
        if (!cancelled) setError("Could not load regions for this company.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const chosen = regions.find((r) => r.label === selectedRegion) || null;
  const alreadyThere = eligibleCandidates.filter(
    (c) => (c.joiningRegionLabel || "").toLowerCase() === selectedRegion.toLowerCase(),
  ).length;
  const willMove = eligibleCandidates.length - alreadyThere;

  const allSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selected[String(c.id)]);

  function toggleAll() {
    const next: Record<string, boolean> = {};
    if (!allSelected) {
      for (const c of filteredCandidates) next[String(c.id)] = true;
    }
    setSelected(next);
  }

  async function handleSubmit() {
    if (saving || !selectedRegion || !chosen?.eligible) return;
    const candidateIds = filteredCandidates
      .map((c) => String(c.id))
      .filter((cid) => selected[cid]);
    if (candidateIds.length === 0) {
      setError("Select at least one candidate.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/bulk-region`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds,
          regionLabel: selectedRegion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to distribute candidates.");
        return;
      }
      onDone(data as DistributeResult);
    } catch {
      setError("Failed to distribute candidates. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
        <div className="w-full max-w-lg rounded-lg neu-card p-5">
          <p className="text-sm text-slate-500">Loading regions…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-lg rounded-lg neu-card">
        <header className="flex items-center justify-between border-b border-[var(--c-border-light)] px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Distribute Candidates to Region</h2>
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-[var(--c-bg-muted)]" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          <p className="text-sm text-slate-600">
            Select a region to send eligible candidates to. That region&apos;s HR/Admin heads will be notified and can generate offer letters.
          </p>

          {regions.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              This company has no offices configured. Add an office under settings before distributing candidates.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Region</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">Select a region…</option>
                  {regions.map((r) => (
                    <option key={r.label} value={r.label} disabled={!r.eligible}>
                      {r.displayLabel || r.label}
                      {r.eligible ? "" : " — no HR or Admin assigned"}
                    </option>
                  ))}
                </select>
              </label>

              {chosen && (
                <div className="rounded-lg bg-[var(--c-bg-muted)] p-3 text-xs text-slate-600">
                  <div className="flex justify-between gap-3">
                    <span>HR head</span>
                    <span className="font-medium text-slate-800">
                      {chosen.hrHeadName || <span className="text-amber-700">none assigned</span>}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>Admin head</span>
                    <span className="font-medium text-slate-800">
                      {chosen.adminHeadName || <span className="text-amber-700">none assigned</span>}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>HR / Admin roster</span>
                    <span className="font-medium text-slate-800">
                      {chosen.hrCount + chosen.adminCount} member{chosen.hrCount + chosen.adminCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  State <span className="text-xs font-normal text-slate-400">(filters candidates)</span>
                </span>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
                  disabled={candidateStates.length === 0}
                >
                  <option value="">All states</option>
                  {candidateStates.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Candidates ({Object.values(selected).filter(Boolean).length} selected
                    {stateFilter ? ` · ${filteredCandidates.length} in ${stateFilter}` : ""})
                  </span>
                  <button type="button" onClick={toggleAll} className="text-xs font-medium text-indigo-600 hover:underline">
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--c-border-light)]">
                  {filteredCandidates.length === 0 && (
                    <p className="p-3 text-sm text-slate-400">
                      {eligibleCandidates.length === 0
                        ? "No eligible candidates. Candidates must have completed interviews and be selected for offer-letter."
                        : "No candidates in this state."}
                    </p>
                  )}
                  {filteredCandidates.map((c) => {
                    const cid = String(c.id);
                    const cRegion = String(c.regionLabel || "");
                    const currentRegion = String(c.joiningRegionLabel || "");
                    const staying = currentRegion.toLowerCase() === selectedRegion.toLowerCase();
                    return (
                      <div key={cid} className="flex items-center gap-2 border-b border-[var(--c-border-light)] px-3 py-2 last:border-b-0 hover:bg-[var(--c-bg-muted)]">
                        <input
                          type="checkbox"
                          checked={!!selected[cid]}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [cid]: e.target.checked }))}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                          {c.firstName} {c.lastName}
                        </span>
                        {cRegion && (
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                            {cRegion}
                          </span>
                        )}
                        {currentRegion && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${staying ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-700"}`}>
                            {staying ? "already there" : currentRegion}
                          </span>
                        )}
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {STAGE_LABELS[c.stage as keyof typeof STAGE_LABELS] || c.stage}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {alreadyThere > 0 && chosen && (
                <p className="text-xs text-slate-500">
                  {alreadyThere} of these are already in {chosen.displayLabel || chosen.label} and will be left alone.
                </p>
              )}
            </>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={saving || !chosen?.eligible || willMove === 0}
              className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Distributing…"
                : willMove === 0 && chosen
                  ? "Nothing to distribute"
                  : `Distribute ${willMove}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
