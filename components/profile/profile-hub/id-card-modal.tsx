"use client";

import { X, Printer } from "lucide-react";
import type { AnyRecord } from "./shared";

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
  const role = displayRole;
  const phone = profile?.phone ? String(profile.phone) : "—";
  const address = profile?.address ? String(profile.address) : "—";
  const companyName = company?.name ? String(company.name) : "—";
  const companyAddr = company?.address ? String(company.address) : "";
  const companyIcon = company?.icon ? String(company.icon) : "/Logos/logo.jpg";

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
          .id-card-inner { box-shadow: none !important; border: 2px solid #e2e8f0 !important; width: 400px !important; }
          @page { margin: 0; }
        }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 id-card-print-wrapper" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl id-card-inner">
          {/* Toolbar */}
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

          {/* Card Header */}
          <div className="border-b border-slate-100 px-5 py-4 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <img src={companyIcon} alt="Company" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
              <p className="text-base font-bold text-slate-900">{companyName}</p>
              {companyAddr ? <p className="text-[11px] text-slate-500 leading-tight max-w-[260px]">{companyAddr}</p> : null}
            </div>
          </div>

          {/* Card Body */}
          <div className="flex gap-4 px-5 py-5">
            {/* Left — Avatar */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              {avatarUrl ? (
                <img
                  alt={`${displayName} avatar`}
                  className="h-20 w-20 rounded-full border-2 border-slate-200 object-cover"
                  src={avatarUrl}
                />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-2xl font-bold text-white shadow-sm">
                  {initials}
                </div>
              )}
            </div>

            {/* Right — Details */}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Unique ID</p>
                <p className="text-sm font-bold text-indigo-700 break-all">{uniqueId}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Name</p>
                <p className="text-sm font-semibold text-slate-900 capitalize">{displayName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Role</p>
                <p className="text-sm text-slate-700 capitalize">{role}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Phone</p>
                <p className="text-sm text-slate-700">{phone}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Address</p>
                <p className="text-sm text-slate-700 leading-snug">{address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
