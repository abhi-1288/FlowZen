"use client";

import { X, Printer } from "lucide-react";
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
  return name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 20) || "company";
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
  if (!open) return null;

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "U";

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

  const detailRows: { label: string; value: string }[] = [
    { label: "Employee ID", value: uniqueId },
    { label: "Name", value: displayName },
    ...(teamName ? [{ label: "Department", value: teamName }] : []),
    { label: "Designation", value: displayRole },
    { label: "Phone", value: phone },
    { label: "Email", value: email },
  ];

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body > *:not(.id-card-print-wrapper) { display: none !important; }
          .id-card-print-wrapper { position: fixed !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: white !important; z-index: 9999 !important; }
          .id-card-print-hide { display: none !important; }
          .id-card-inner { box-shadow: none !important; border: 2px solid #000 !important; width: 500px !important; border-radius: 0 !important; }
          @page { margin: 0; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 id-card-print-wrapper"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-[500px] rounded-2xl border border-slate-200 bg-white shadow-xl id-card-inner">

          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 id-card-print-hide">
            <h3 className="text-sm font-semibold text-slate-900">ID Card</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
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

          {/* ── Company Header (bordered box) ── */}
          <div className="border-b border-slate-200 px-5 py-4 text-center">
            <div className="mx-auto inline-flex flex-col items-center gap-1.5">
              <img src={companyIcon} alt="Company" className="h-12 w-12 rounded-lg border border-slate-300 object-cover" />
              <p className="text-base font-bold uppercase text-slate-900 tracking-wide leading-tight">{companyName}</p>
              {companyAddr ? <p className="text-[11px] text-slate-600 leading-tight">{companyAddr}</p> : null}
            </div>
          </div>

          {/* ── EMPLOYEE ID CARD heading ── */}
          <div className="px-5 pt-4 pb-3 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-slate-800">Employee ID Card</p>
          </div>

          {/* ── Photo + Details ── */}
          <div className="flex gap-5 px-5 pb-4">
            {/* Photo */}
            <div className="flex shrink-0 flex-col items-center">
              <div className="flex h-24 w-24 items-center justify-center border-2 border-slate-300 bg-slate-50">
                {avatarUrl ? (
                  <img
                    alt={`${displayName} avatar`}
                    className="h-full w-full object-cover"
                    src={avatarUrl}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-2xl font-bold text-white">
                    {initials}
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {detailRows.map((row) => (
                <div key={row.label} className="flex gap-2">
                  <span className="w-24 shrink-0 text-[11px] font-semibold text-slate-500">{row.label}</span>
                  <span className="text-[11px] font-medium text-slate-900 break-all">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── Issue Date / Valid Till ── */}
          <div className="flex gap-8 px-5 py-3 text-[11px]">
            <div className="flex gap-2">
              <span className="font-semibold text-slate-500">Issue Date :</span>
              <span className="text-slate-900">{issueDate}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-slate-500">Valid Till :</span>
              <span className="font-medium text-green-700">Active Employee</span>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── Authorized Signature + Address ── */}
          <div className="flex gap-4 px-5 py-3">
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Authorized Signature</p>
              <div className="mt-5 border-b border-slate-400 w-40" />
            </div>
            {personalAddr && (
              <div className="flex-1 border border-slate-300 p-2">
                <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Address</p>
                <p className="text-[11px] text-slate-900 whitespace-pre-line leading-snug">{personalAddr}</p>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── Emergency Contact ── */}
          <div className="px-5 py-2">
            <p className="text-[11px] font-semibold text-slate-500">Emergency Contact</p>
            <p className="text-[11px] text-slate-900">—</p>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── Blood Group ── */}
          <div className="px-5 py-2">
            <p className="text-[11px] font-semibold text-slate-500">Blood Group</p>
            <p className="text-[11px] text-slate-900">—</p>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── Joining Date ── */}
          <div className="px-5 py-2">
            <p className="text-[11px] font-semibold text-slate-500">Joining Date</p>
            <p className="text-[11px] text-slate-900">{joiningDate}</p>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── QR Code ── */}
          <div className="flex flex-col items-center px-5 py-3">
            <div className="grid h-16 w-16 place-items-center border-2 border-slate-800">
              <div className="grid grid-cols-5 gap-0.5">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={`h-1.5 w-1.5 ${Math.random() > 0.5 ? "bg-slate-900" : "bg-white"}`} />
                ))}
              </div>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">QR Code</p>
            <p className="text-[9px] text-slate-400">Scan to verify employee</p>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-300 mx-5" />

          {/* ── Footer ── */}
          <div className="px-5 py-3 text-center">
            <p className="text-[10px] text-slate-500">If found please return to</p>
            <p className="text-[11px] font-bold text-slate-900">{companyName}</p>
            <p className="text-[10px] text-slate-600">{supportEmail}</p>
            <p className="text-[10px] text-slate-600">{website}</p>
          </div>

          {/* bottom padding */}
          <div className="h-3" />
        </div>
      </div>
    </>
  );
}
