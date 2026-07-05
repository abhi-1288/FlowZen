"use client";

import { useEffect, useState } from "react";
import { X, Printer, RotateCw } from "lucide-react";
import QRCode from "qrcode";
import type { AnyRecord } from "./shared";

function formatDate(val: unknown): string {
  if (!val) return "—";
  try {
    return new Date(String(val)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function deriveCompanyDomain(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 20) || "company";
}

export function IdCardModal({
  open,
  onClose,
  profile,
  company,
  avatarUrl,
  displayName,
  displayRole,
}: {
  open: boolean;
  onClose: () => void;
  profile: AnyRecord | null;
  company: AnyRecord | null;
  avatarUrl: string;
  displayName: string;
  displayRole: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  if (!open) return null;

  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "U";

  const uniqueId = profile?.companyIdentityCode ? String(profile.companyIdentityCode) : "—";
  const phone = profile?.phone ? String(profile.phone) : "—";
  const email = profile?.email ? String(profile.email) : "—";
  const personalAddr = profile?.address ? String(profile.address) : "";
  const companyName = company?.name ? String(company.name) : "—";
  const companyAddr = company?.address ? String(company.address) : "";
  const companyIcon = company?.icon ? String(company.icon) : "/Logos/logo.jpg";
  const teamName = typeof profile?.team === "object" && profile?.team ? String((profile.team as AnyRecord).name ?? "") : "";
  const joiningDate = formatDate(profile?.companyJoined);
  const issueDate = formatDate(new Date().toISOString());
  const domain = deriveCompanyDomain(companyName);
  const supportEmail = `support@${domain}.com`;
  const website = `www.${domain}.com`;

  const qrValue = typeof window !== "undefined" ? `${window.location.origin}/verify/${uniqueId}` : "";

  useEffect(() => {
    if (!qrValue || !open) return;
    QRCode.toDataURL(qrValue, { width: 160, margin: 1, color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [qrValue, open]);

  const detailRows: { label: string; value: string }[] = [
    { label: "Employee ID", value: uniqueId },
    { label: "Name", value: displayName },
    ...(teamName ? [{ label: "Department", value: teamName }] : []),
    { label: "Designation", value: displayRole },
    { label: "Phone", value: phone },
    { label: "Email", value: email },
  ];

  return (
    <>
      <style>{`
        @media print {
          body > *:not(.id-card-print-wrapper) { display: none !important; }
          .id-card-print-wrapper { position: fixed !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: white !important; z-index: 9999 !important; }
          .id-card-print-hide { display: none !important; }
          .id-card-side { display: flex !important; border: 2px solid #000 !important; box-shadow: none !important; border-radius: 0 !important; }
          .id-card-back-side { border-top: 2px solid #000 !important; }
          .id-card-side-hidden { display: flex !important; }
          @page { margin: 0; }
          .id-card-back-side { page-break-before: always; padding-top: 20px; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 id-card-print-wrapper"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[420px]">

          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between rounded-t-2xl border border-slate-200 bg-white px-5 py-3 id-card-print-hide">
            <h3 className="text-sm font-semibold text-slate-900">ID Card</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFlipped((f) => !f)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCw size={14} />
                {flipped ? "Front" : "Back"}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Printer size={14} />
                Print
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ══════ FRONT SIDE ══════ */}
          <div className={`id-card-side ${flipped ? "id-card-side-hidden" : ""} rounded-b-2xl border-x border-b border-slate-200 bg-white shadow-xl`}>
            <div className="border-b border-slate-200 px-5 pt-4 pb-3 text-center">
              <div className="mx-auto inline-flex flex-col items-center gap-1">
                <img src={companyIcon} alt="Company" className="h-10 w-10 rounded-lg border border-slate-300 object-cover" />
                <p className="text-sm font-bold uppercase text-slate-900 tracking-wide leading-tight">{companyName}</p>
                {companyAddr ? <p className="text-[10px] text-slate-600 leading-tight">{companyAddr}</p> : null}
              </div>
            </div>

            <div className="px-5 pt-3 pb-2 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-800">Employee ID Card</p>
            </div>

            <div className="flex gap-4 px-5 pb-3">
              <div className="flex shrink-0 flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center border-2 border-slate-300 bg-slate-50">
                  {avatarUrl ? (
                    <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-xl font-bold text-white">
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                {detailRows.map((row) => (
                  <div key={row.label} className="flex gap-1.5">
                    <span className="w-[72px] shrink-0 text-[10px] font-semibold text-slate-500">{row.label}</span>
                    <span className="text-[10px] font-medium text-slate-900 break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-300 mx-5" />

            <div className="flex gap-6 px-5 py-2.5 text-[10px]">
              <div className="flex gap-1.5">
                <span className="font-semibold text-slate-500">Issue Date :</span>
                <span className="text-slate-900">{issueDate}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="font-semibold text-slate-500">Valid Till :</span>
                <span className="font-medium text-green-700">Active Employee</span>
              </div>
            </div>

            <div className="border-t border-slate-300 mx-5" />

            <div className="flex gap-4 px-5 py-2.5">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">Authorized Signature</p>
                <div className="mt-4 border-b border-slate-400 w-32" />
              </div>
              {personalAddr && (
                <div className="flex-1 border border-slate-300 p-1.5">
                  <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Address</p>
                  <p className="text-[10px] text-slate-900 whitespace-pre-line leading-snug">{personalAddr}</p>
                </div>
              )}
            </div>

            <div className="h-2" />
          </div>

          {/* ══════ BACK SIDE ══════ */}
          <div className={`id-card-side id-card-back-side ${flipped ? "" : "id-card-side-hidden"} rounded-b-2xl border-x border-b border-slate-200 bg-white shadow-xl`}>
            <div className="px-5 pt-5 pb-2.5">
              <p className="text-[11px] font-semibold text-slate-500">Emergency Contact</p>
              <p className="text-[11px] text-slate-900">—</p>
            </div>
            <div className="border-t border-slate-300 mx-5" />

            <div className="px-5 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">Blood Group</p>
              <p className="text-[11px] text-slate-900">—</p>
            </div>
            <div className="border-t border-slate-300 mx-5" />

            <div className="px-5 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">Joining Date</p>
              <p className="text-[11px] text-slate-900">{joiningDate}</p>
            </div>
            <div className="border-t border-slate-300 mx-5" />

            <div className="flex flex-col items-center px-5 py-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="h-16 w-16" />
              ) : (
                <div className="grid h-16 w-16 place-items-center border-2 border-slate-300 bg-slate-50">
                  <span className="text-[9px] font-bold text-slate-400">QR</span>
                </div>
              )}
              <p className="mt-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">QR Code</p>
              <p className="text-[8px] text-slate-400">Scan to verify employee</p>
            </div>
            <div className="border-t border-slate-300 mx-5" />

            <div className="px-5 py-3 text-center">
              <p className="text-[9px] text-slate-500">If found please return to</p>
              <p className="text-[10px] font-bold text-slate-900">{companyName}</p>
              <p className="text-[9px] text-slate-600">{supportEmail}</p>
              <p className="text-[9px] text-slate-600">{website}</p>
            </div>
          </div>

          {/* Flip hint */}
          <div className="mt-2 text-center id-card-print-hide">
            <button
              onClick={() => setFlipped((f) => !f)}
              className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700"
            >
              {flipped ? "← Flip to Front" : "Flip to Back →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
