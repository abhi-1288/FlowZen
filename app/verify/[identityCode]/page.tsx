"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-utils";

type VerifyData = {
  verified: boolean;
  reason?: string;
  message?: string;
  name: string;
  role: string;
  companyIdentityCode: string;
  companyJoined: string;
  companyStatus: string;
  avatarUrl: string;
  company: { name: string; icon: string; status: string; primaryColor?: string } | null;
};

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function darkenColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const factor = 0.86;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n * factor).toString(16).padStart(2, "0")).join("")}`;
}

function getErrorData(reason: string, message: string) {
  if (reason === "revoked") {
    return {
      title: "ID Card Revoked",
      description: message,
      borderColor: "border-amber-200",
      badgeBg: "bg-amber-100",
      iconColor: "text-amber-600",
    };
  }
  return {
    title: "Invalid ID Card",
    description: message || "Employee not found.",
    borderColor: "border-red-200",
    badgeBg: "bg-red-100",
    iconColor: "text-red-600",
  };
}

export default function VerifyPage() {
  const params = useParams();
  const identityCode = params?.identityCode as string | undefined;
  const [data, setData] = useState<VerifyData | null>(null);
  const [error, setError] = useState("");
  const [errorData, setErrorData] = useState<{ title: string; description: string; borderColor: string; badgeBg: string; iconColor: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identityCode) {
      setError("No identity code provided.");
      setLoading(false);
      return;
    }
    apiFetch<VerifyData>(`/api/public/verify/${encodeURIComponent(identityCode)}`)
      .then((res) => {
        if (!res.verified) {
          const errData = getErrorData(res.reason || "", res.message || "");
          setErrorData(errData);
          setError(errData.description);
          return;
        }
        setData(res);
      })
      .catch((err: Error) => {
        const msg = err.message || "Failed to verify ID card.";
        setErrorData({
          title: "Invalid ID Card",
          description: msg,
          borderColor: "border-red-200",
          badgeBg: "bg-red-100",
          iconColor: "text-red-600",
        });
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [identityCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">ID Card Verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Scan QR code to verify employee identity
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200"
              style={{ borderTopColor: "#2563eb" }}
            />
            <p className="mt-4 text-sm text-slate-500">Verifying...</p>
          </div>
        )}

        {error && !data && errorData && (
          <div className={`rounded-2xl border ${errorData.borderColor} bg-white p-8 text-center shadow-sm`}>
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${errorData.badgeBg}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${errorData.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-800">{errorData.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{errorData.description}</p>
            <p className="mt-4 text-xs text-slate-400">
              If you believe this is an error, please contact the issuing company&apos;s HR department.
            </p>
          </div>
        )}

        {data && (
          <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
            {/* Verified badge */}
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Verified Employee</p>
                <p className="text-xs text-emerald-600">Identity confirmed</p>
              </div>
            </div>

            {/* Employee details */}
            <div className="p-6">
              {/* Avatar + Name */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100">
                  {data.avatarUrl ? (
                    <img src={data.avatarUrl} alt={data.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${data.company?.primaryColor || "#2563eb"}, ${data.company?.primaryColor ? darkenColor(data.company.primaryColor) : "#1d4ed8"})` }}
                    >
                      {getInitials(data.name)}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{data.name}</h2>
                  <p className="text-sm capitalize text-slate-500">{data.role}</p>
                </div>
              </div>

              {/* Detail rows */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500">Employee ID</span>
                  <span className="text-sm font-semibold" style={{ color: data.company?.primaryColor || "#2563eb" }}>{data.companyIdentityCode}</span>
                </div>

                {data.company && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-medium text-slate-500">Company</span>
                    <span className="text-sm font-semibold text-slate-900">{data.company.name}</span>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                  <span className="text-xs font-medium text-slate-500">Joined</span>
                  <span className="text-sm font-semibold text-slate-900">{formatDate(data.companyJoined)}</span>
                </div>

                {data.company && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-medium text-slate-500">Company Status</span>
                    <span className={`text-sm font-semibold ${data.company.status === "active" ? "text-emerald-600" : "text-amber-600"}`}>
                      {data.company.status === "active" ? "Active" : data.company.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Verification footer */}
              <div className="mt-6 border-t border-slate-100 pt-4 text-center">
                <p className="text-xs text-slate-400">
                  Verified at {new Date().toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-[10px] text-slate-300">
                  Powered by FlowZen
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
