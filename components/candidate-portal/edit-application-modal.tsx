"use client";

import { useState } from "react";
import { X, Upload, FileText, Loader2, CheckCircle, Pencil } from "lucide-react";
import { hexToRgba } from "@/lib/accent";

type EditCandidate = {
  firstName: string;
  lastName: string;
  phone?: string;
  portfolioUrl?: string;
  linkedInUrl?: string;
  resumeUrl?: string;
  email: string;
};

export default function EditApplicationModal({
  candidate,
  token,
  accent,
  onClose,
  onSaved,
}: {
  candidate: EditCandidate;
  token: string;
  accent: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const orig = {
    firstName: candidate.firstName,
    lastName: candidate.lastName ?? "",
    phone: candidate.phone ?? "",
    portfolioUrl: candidate.portfolioUrl ?? "",
    linkedInUrl: candidate.linkedInUrl ?? "",
    resumeUrl: candidate.resumeUrl ?? "",
  };

  const [firstName, setFirstName] = useState(orig.firstName);
  const [lastName, setLastName] = useState(orig.lastName);
  const [phone, setPhone] = useState(orig.phone);
  const [portfolioUrl, setPortfolioUrl] = useState(orig.portfolioUrl);
  const [linkedInUrl, setLinkedInUrl] = useState(orig.linkedInUrl);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const currentFileName = orig.resumeUrl
    ? decodeURIComponent(orig.resumeUrl.split("/").pop() ?? "").replace(/^resume-/, "").replace(/-\d+\./, ".")
    : "";

  function resetToOriginal() {
    setFirstName(orig.firstName);
    setLastName(orig.lastName);
    setPhone(orig.phone);
    setPortfolioUrl(orig.portfolioUrl);
    setLinkedInUrl(orig.linkedInUrl);
    setResumeFile(null);
    setConfirming(false);
    setError("");
  }

  const changes: string[] = [];
  if (firstName.trim() !== orig.firstName) changes.push(`Name: ${orig.firstName} ${orig.lastName} → ${firstName.trim()} ${lastName.trim()}`);
  if (lastName.trim() !== orig.lastName && lastName.trim() !== "") changes.push(`Last name: ${orig.lastName} → ${lastName.trim()}`);
  if (phone.trim() !== orig.phone) changes.push(phone.trim() ? `Phone: ${orig.phone || "—"} → ${phone.trim()}` : "Phone: removed");
  if (portfolioUrl.trim() !== orig.portfolioUrl) changes.push(portfolioUrl.trim() ? `Portfolio: ${orig.portfolioUrl || "—"} → ${portfolioUrl.trim()}` : "Portfolio: removed");
  if (linkedInUrl.trim() !== orig.linkedInUrl) changes.push(linkedInUrl.trim() ? `LinkedIn: ${orig.linkedInUrl || "—"} → ${linkedInUrl.trim()}` : "LinkedIn: removed");
  if (resumeFile) changes.push(`Resume: replaced with ${resumeFile.name} (old file will be deleted)`);

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("firstName", firstName.trim());
      fd.append("lastName", lastName.trim());
      fd.append("phone", phone.trim());
      fd.append("portfolioUrl", portfolioUrl.trim());
      fd.append("linkedInUrl", linkedInUrl.trim());
      if (resumeFile) fd.append("resume", resumeFile);

      const res = await fetch(`/api/public/candidate/me/application?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSuccess(true);
      onSaved();
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "mt-1 w-full rounded-xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#0d0d0d] px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 outline-none transition focus:ring-2 focus:ring-slate-300 dark:focus:ring-zinc-700";
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-zinc-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--c-border-light)] dark:border-zinc-800 bg-[var(--c-bg-card)] dark:bg-[#0d0d0d] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Edit application</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-[var(--c-bg-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle size={36} style={{ color: "#059669" }} />
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-100">Application updated</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Your changes have been saved.</p>
            </div>
          ) : confirming ? (
            <>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Review the changes below. They will be applied to your application.
              </p>
              <div className="mt-4 space-y-2">
                {changes.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--c-border-light)] px-3 py-2.5 text-xs text-slate-700 dark:border-zinc-800 dark:text-zinc-300"
                    style={{ backgroundColor: hexToRgba(accent, 0.06) }}
                  >
                    {c}
                  </div>
                ))}
              </div>
              {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>First name *</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Phone number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Resume (PDF)</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: accent }}>
                    <Upload size={13} /> {resumeFile ? resumeFile.name : "Choose new resume"}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                {resumeFile ? (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                    {orig.resumeUrl ? "The old resume will be deleted when you save." : ""}
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                    <FileText size={12} /> {currentFileName || "No resume uploaded yet"}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Portfolio URL</label>
                <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://…" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>LinkedIn URL</label>
                <input value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} placeholder="https://linkedin.com/in/…" className={inputCls} />
              </div>

              <div className="rounded-xl px-4 py-3 text-[11px] text-slate-500 dark:text-zinc-400" style={{ backgroundColor: hexToRgba(accent, 0.06) }}>
                Email ({candidate.email}) cannot be changed here.
              </div>

              {error && <p className="text-xs text-rose-500">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--c-border-light)] px-6 py-4 dark:border-zinc-800">
          {success ? (
            <button onClick={onClose} className="rounded-full border border-[var(--c-border-light)] px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-[var(--c-bg-muted)] dark:text-zinc-300">
              Close
            </button>
          ) : confirming ? (
            <>
              <button
                onClick={() => { resetToOriginal(); onClose(); }}
                disabled={saving}
                className="rounded-full border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-[var(--c-bg-muted)] disabled:opacity-50 dark:text-zinc-300"
              >
                No, revert
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Yes, update
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-full border border-[var(--c-border-light)] px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-[var(--c-bg-muted)] dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirming(true)}
                disabled={changes.length === 0}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                <Pencil size={13} /> Save changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}