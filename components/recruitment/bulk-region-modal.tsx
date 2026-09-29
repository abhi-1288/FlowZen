"use client";

import { useEffect, useState } from "react";
import type { ATSCandidate } from "@/lib/recruitment-types";

/**
 * Pick an office to hand the selected candidates to.
 *
 * The endpoint (`/api/recruitment/jobs/<id>/bulk-region`) is the authority on
 * which regions are eligible, so this reads its GET rather than reusing a region
 * list from elsewhere. A region with no head and no roster is disabled here with
 * the reason shown, instead of letting the user fill the form and only then
 * being refused — the same rule, applied before the click rather than after.
 *
 * Re-sending is allowed. The copy says so explicitly, because "Send" on a
 * candidate that already has a region reads like a no-op or a mistake otherwise.
 */

type RegionOption = {
  label: string;
  displayLabel: string;
  hrHead: string;
  adminHead: string;
  hrHeadName: string;
  adminHeadName: string;
  hrCount: number;
  adminCount: number;
  eligible: boolean;
};

export type RegionTransferResult = {
  moved: number;
  unchanged: number;
  skipped: number;
  /**
   * Requested ids the server did not return: either deleted or owned by another
   * region. Reported as one undifferentiated count by design, so the response
   * cannot be used to probe whether a foreign candidate id exists.
   */
  notVisible: number;
  region: string;
  regionLabel: string;
  regionHasApprover: boolean;
};

export function BulkRegionModal({
  jobId,
  targets,
  onClose,
  onDone,
}: {
  jobId: string;
  targets: ATSCandidate[];
  onClose: () => void;
  onDone: (result: RegionTransferResult) => void;
}) {
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const chosen = regions.find((r) => r.label === selected) || null;
  const alreadyThere = targets.filter(
    (c) => (c.joiningRegionLabel || "").toLowerCase() === selected.toLowerCase(),
  ).length;
  const willMove = targets.length - alreadyThere;

  async function handleConfirm() {
    if (saving || !selected || !chosen?.eligible) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/bulk-region`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: targets.map((c) => c.id),
          regionLabel: selected,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to send these candidates.");
        return;
      }
      onDone(data as RegionTransferResult);
    } catch {
      setError("Failed to send these candidates. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center neu-overlay px-4">
      <div className="w-full max-w-md rounded-lg neu-card">
        <div className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Send {targets.length} candidate{targets.length === 1 ? "" : "s"} to a region
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            That region&apos;s HR and Admin can then generate the offer. It is also the office the
            new joiner is filed under, and the region whose head approves the join.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading regions…</p>
          ) : regions.length === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              This company has no offices configured. Add an office under settings before sending
              candidates to a region.
            </p>
          ) : (
            <>
              <label className="mt-4 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Region</span>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
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

              {regions.some((r) => !r.eligible) && (
                <p className="mt-2 text-xs text-slate-500">
                  Regions with no HR head, Admin head or roster are unavailable — nobody would
                  receive the candidates.
                </p>
              )}

              {chosen && (
                <div className="mt-3 rounded-lg bg-[var(--c-bg-muted)] p-3 text-xs text-slate-600">
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
                      {chosen.hrCount + chosen.adminCount} member
                      {chosen.hrCount + chosen.adminCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {!chosen.hrHead && !chosen.adminHead && (
                    <p className="mt-2 text-amber-700">
                      No head is assigned, so the conversion will fall back to the HR who converts
                      the candidate for approval.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 max-h-28 overflow-y-auto rounded-lg bg-[var(--c-bg-muted)] p-2">
                <ul className="space-y-1">
                  {targets.map((c) => {
                    const current = c.joiningRegionLabel || "";
                    const staying = current.toLowerCase() === selected.toLowerCase();
                    return (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-xs text-slate-600"
                      >
                        <span className="min-w-0 truncate">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="shrink-0">
                          {current ? (
                            <span className={staying ? "text-slate-400" : "text-indigo-600"}>
                              {staying ? "already there" : current}
                            </span>
                          ) : (
                            <span className="text-slate-400">unassigned</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {alreadyThere > 0 && chosen && (
                <p className="mt-2 text-xs text-slate-500">
                  {alreadyThere} of these are already in {chosen.displayLabel || chosen.label} and
                  will be left alone.
                </p>
              )}
            </>
          )}

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-[var(--c-bg-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={saving || !chosen?.eligible || willMove === 0}
              className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Sending…"
                : willMove === 0 && chosen
                  ? "Nothing to send"
                  : `Send ${willMove}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
