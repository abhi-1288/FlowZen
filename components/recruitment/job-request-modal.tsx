"use client";

import { useEffect, useState } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";
import { apiFetch } from "@/lib/client-utils";

type HRUser = { id: string; name: string; email: string };

export function JobRequestModal({ onClose }: { onClose: () => void }) {
  const { requestJob, saving } = useRecruitmentStore();
  const [title, setTitle] = useState("");
  const [openings, setOpenings] = useState(1);
  const [assignedHR, setAssignedHR] = useState("");
  const [hrUsers, setHrUsers] = useState<HRUser[]>([]);
  const [loadingHr, setLoadingHr] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchHR() {
      try {
        const data = await apiFetch<{ users: any[] }>("/api/users?role=human-resource");
        setHrUsers((data.users ?? []).map((u: any) => ({ id: u._id ?? u.id, name: u.name, email: u.email })));
      } catch {
        setHrUsers([]);
      } finally {
        setLoadingHr(false);
      }
    }
    void fetchHR();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Position name is required."); return; }
    if (!assignedHR) { setError("Please select an HR."); return; }
    try {
      await requestJob({ title: title.trim(), assignedHR, openings });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to create request.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">New Job Request</h2>
          <button suppressHydrationWarning className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Position Name *</span>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Senior Frontend Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Number of Openings *</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              value={openings}
              onChange={(e) => setOpenings(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Assign HR *</span>
            {loadingHr ? (
              <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
            ) : (
              <select
                suppressHydrationWarning
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                value={assignedHR}
                onChange={(e) => setAssignedHR(e.target.value)}
              >
                <option value="">Select HR...</option>
                {hrUsers.map((hr) => (
                  <option key={hr.id} value={hr.id}>{hr.name} ({hr.email})</option>
                ))}
              </select>
            )}
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button suppressHydrationWarning
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button suppressHydrationWarning
              type="submit"
              disabled={saving || loadingHr}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
