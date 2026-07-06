"use client";

import { useState } from "react";
import { X, Calendar, Clock } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { MEETING_DURATION_OPTIONS, type MeetingDuration } from "../types";
import type { AnyRecord } from "../../shared";

export function MeetingInviteModal({
  member,
  onClose,
  showToast,
}: {
  member: AnyRecord | null;
  onClose: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [title, setTitle] = useState(`Meeting with ${String(member?.name ?? "")}`);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState<MeetingDuration>(30);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  if (!member) return null;

  const handleSubmit = async () => {
    if (!title.trim()) { showToast("Meeting title is required.", "error"); return; }
    if (!date) { showToast("Meeting date is required.", "error"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/company/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          date,
          time,
          durationMinutes: duration,
          description: description.trim(),
          participantIds: [String(member.id)],
        }),
      });
      showToast("Meeting scheduled successfully.", "success");
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not schedule meeting.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h4 className="text-lg font-semibold text-slate-900">Schedule Meeting</h4>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">With</label>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              {String(member.name ?? "")} ({String(member.email ?? "")})
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
              placeholder="Meeting title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                <Calendar size={12} /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                <Clock size={12} /> Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) as MeetingDuration)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
            >
              {MEETING_DURATION_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
              placeholder="Any additional details..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={saving || !title.trim() || !date}
            onClick={handleSubmit}
            className="rounded-lg bg-[var(--color-primary,#2563eb)] px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Scheduling..." : "Schedule Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
