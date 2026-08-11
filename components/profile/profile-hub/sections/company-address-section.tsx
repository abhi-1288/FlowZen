"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { Send, Clock, CheckCircle, MapPin, ToggleLeft, ToggleRight, UserCheck, UserX } from "lucide-react";
import type { AnyRecord } from "../shared";

interface AdminOption {
  id: string;
  name: string;
  email: string;
}

interface HrOption {
  id: string;
  name: string;
  email: string;
}

export function CompanyAddressSection({
  company,
  role,
  userId,
  showToast,
  refresh,
}: {
  company: AnyRecord | null;
  role: string;
  userId: string;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const multiOffice = company?.multiOffice ? Boolean(company.multiOffice) : false;
  const approvedAddresses = multiOffice && Array.isArray(company?.addresses) ? (company.addresses as AnyRecord[]) : [];

  return (
    <section className="rounded-xl neu-card p-5">
      <div className="mb-4 border-l-4 border-indigo-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Office Address Management</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage multi-office settings and submit new addresses.
        </p>
      </div>

      {/* Summary card */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--c-border-light)] bg-gradient-to-br from-slate-50 to-white p-4 dark:border-zinc-800 dark:from-zinc-900 dark:to-[#000000]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/70">
            <MapPin size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">Multi-Office Mode</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {multiOffice
                ? `${approvedAddresses.length} approved office${approvedAddresses.length !== 1 ? "s" : ""}`
                : "Single office"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg neu-card px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] hover:text-slate-800 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Edit
        </button>
      </div>

      {/* Modal */}
      {open && (
        <AddressModal
          company={company}
          role={role}
          userId={userId}
          showToast={showToast}
          refresh={refresh}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function AddressModal({
  company,
  role,
  userId,
  showToast,
  refresh,
  onClose,
}: {
  company: AnyRecord | null;
  role: string;
  userId: string;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrLine1, setNewAddrLine1] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrState, setNewAddrState] = useState("");
  const [newAddrZip, setNewAddrZip] = useState("");
  const [newAddrCountry, setNewAddrCountry] = useState("");
  const [submittingAddr, setSubmittingAddr] = useState(false);
  const [pendingAddresses, setPendingAddresses] = useState<AnyRecord[]>([]);
  const [toggling, setToggling] = useState(false);
  const [hrs, setHrs] = useState<HrOption[]>([]);
  const [authorizedHrs, setAuthorizedHrs] = useState<string[]>([]);
  const [managingHr, setManagingHr] = useState(false);

  const isAdmin = role === "admin";
  const multiOffice = company?.multiOffice ? Boolean(company.multiOffice) : false;
  const approvedAddresses = multiOffice && Array.isArray(company?.addresses) ? (company.addresses as AnyRecord[]) : [];
  const legacyAddress = !multiOffice && company?.address ? String(company.address).trim() : "";

  const isAuthHr = !isAdmin && role === "human-resource" && multiOffice
    && (company?.addressManagers as string[] ?? []).includes(userId);

  useEffect(() => {
    if (!multiOffice) return;
    apiFetch<{ admins: AdminOption[] }>("/api/company/admins")
      .then((data) => {
        setAdmins(data.admins ?? []);
        if (data.admins?.length === 1) setSelectedAdminId(data.admins[0].id);
      })
      .catch(() => {});
    apiFetch<{ requests: AnyRecord[] }>("/api/approvals")
      .then((data) => {
        const regionReqs = (data.requests ?? []).filter(
          (r: AnyRecord) => String(r.kind ?? "") === "region-address" && String(r.status) === "pending",
        );
        setPendingAddresses(regionReqs);
      })
      .catch(() => {});

    if (isAdmin) {
      const managers = (company?.addressManagers as string[] ?? []).map((id: any) => String(id));
      setAuthorizedHrs(managers);
      apiFetch<{ hrs: HrOption[] }>("/api/company/hrs")
        .then((data) => setHrs(data.hrs ?? []))
        .catch(() => {});
    }
  }, [multiOffice, isAdmin]);

  const handleToggleMultiOffice = async () => {
    if (!isAdmin) return;
    setToggling(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({ multiOffice: !multiOffice }),
      });
      await refresh();
      showToast(multiOffice ? "Multi-office mode disabled." : "Multi-office mode enabled.", "success");
    } catch {
      showToast("Failed to toggle multi-office mode.", "error");
    } finally {
      setToggling(false);
    }
  };

  const handleToggleHr = async (hrId: string) => {
    const next = authorizedHrs.includes(hrId)
      ? authorizedHrs.filter((id) => id !== hrId)
      : [...authorizedHrs, hrId];
    setAuthorizedHrs(next);
    setManagingHr(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({ addressManagers: next }),
      });
      await refresh();
    } catch {
      setAuthorizedHrs(authorizedHrs);
      showToast("Failed to update HR access.", "error");
    } finally {
      setManagingHr(false);
    }
  };

  const handleSubmitAddress = async () => {
    if (!newAddrLabel.trim()) { showToast("Region/office name is required.", "error"); return; }
    if (!newAddrLine1.trim()) { showToast("Address line 1 is required.", "error"); return; }
    if (!selectedAdminId) { showToast("Please select an admin to approve.", "error"); return; }
    setSubmittingAddr(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "submit-address",
          adminId: selectedAdminId,
          label: newAddrLabel,
          line1: newAddrLine1,
          city: newAddrCity,
          state: newAddrState,
          zip: newAddrZip,
          country: newAddrCountry,
        }),
      });
      showToast("Address submitted for admin approval.", "success");
      setNewAddrLabel("");
      setNewAddrLine1("");
      setNewAddrCity("");
      setNewAddrState("");
      setNewAddrZip("");
      setNewAddrCountry("");
      const data = await apiFetch<{ requests: AnyRecord[] }>("/api/approvals");
      const regionReqs = (data.requests ?? []).filter(
        (r: AnyRecord) => String(r.kind ?? "") === "region-address" && String(r.status) === "pending",
      );
      setPendingAddresses(regionReqs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit address.", "error");
    } finally {
      setSubmittingAddr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--c-bg-card)] p-6 shadow-xl dark:border dark:border-zinc-800 dark:bg-[#000000]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Office Address Management</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage multi-office settings and submit new addresses.</p>
          </div>
          <button
            className="shrink-0 rounded-lg border border-[var(--c-border-light)] px-2 py-1 text-sm text-slate-500 hover:bg-[var(--c-bg-muted)] dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-5">
        {/* Multi-office toggle (admin only) */}
        {isAdmin && (
          <div className="flex items-center justify-between rounded-lg border border-[var(--c-border-light)] p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-slate-500 dark:text-zinc-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Multiple offices in different regions</span>
            </div>
            <button
              type="button"
              disabled={toggling}
              onClick={handleToggleMultiOffice}
              className="text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {multiOffice ? <ToggleRight size={24} className="text-indigo-600" /> : <ToggleLeft size={24} />}
            </button>
          </div>
        )}

        {/* HR info when multi-office is off */}
        {!multiOffice && !isAdmin && (
          <p className="text-sm text-slate-400 italic">Multi-office mode is currently disabled. Contact your admin to enable it.</p>
        )}

        {multiOffice && (
          <>
            {/* Admin: manage authorized HRs */}
            {isAdmin && hrs.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Authorized HR Managers</span>
                <p className="text-xs text-slate-400 mt-0.5 mb-2 dark:text-zinc-500">Select which HR members can submit office addresses.</p>
                <div className="space-y-1.5">
                  {hrs.map((hr) => {
                    const isAuthorized = authorizedHrs.includes(hr.id);
                    return (
                      <div key={hr.id} className="flex items-center justify-between rounded-lg border border-[var(--c-border-light)] px-3 py-2 dark:border-zinc-800 dark:bg-[#0b0b0b]">
                        <div className="flex items-center gap-2">
                          {isAuthorized ? <UserCheck size={14} className="text-emerald-500" /> : <UserX size={14} className="text-slate-300 dark:text-zinc-600" />}
                          <span className="text-sm text-slate-700 dark:text-zinc-200">{hr.name}</span>
                          <span className="text-xs text-slate-400 dark:text-zinc-500">({hr.email})</span>
                        </div>
                        <button
                          type="button"
                          disabled={managingHr}
                          onClick={() => handleToggleHr(hr.id)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${ isAuthorized ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40" } disabled:opacity-50`}
                        >
                          {isAuthorized ? "Revoke" : "Authorize"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unauthorized HR message */}
            {!isAdmin && role === "human-resource" && !isAuthHr && (
              <p className="text-sm text-slate-400 italic dark:text-zinc-500">You are not authorized to submit office addresses. Contact your admin for access.</p>
            )}

            {/* Approved offices */}
            {approvedAddresses.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Approved Offices</span>
                <div className="mt-2 space-y-2">
                  {approvedAddresses.map((addr, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--c-border-light)] p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{String(addr.label ?? "")}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {[String(addr.line1 ?? ""), String(addr.city ?? ""), String(addr.state ?? "")].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {approvedAddresses.length >= 2 && isAdmin ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            onClick={async () => {
                              const next = approvedAddresses.filter((_, idx) => idx !== i);
                              try {
                                await apiFetch("/api/company/address", {
                                  method: "PATCH",
                                  body: JSON.stringify({ addresses: next }),
                                });
                                await refresh();
                                showToast("Office address removed.");
                              } catch {
                                showToast("Failed to remove address.", "error");
                              }
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                        <CheckCircle size={16} className="shrink-0 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show legacy single address when multi-office is off */}
            {!multiOffice && legacyAddress && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Office Address</span>
                <div className="mt-2 rounded-lg neu-inset/50 p-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">Main Office</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{legacyAddress}</p>
                </div>
              </div>
            )}

            {/* Pending submissions */}
            {pendingAddresses.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Pending Approval</span>
                <div className="mt-2 space-y-2">
                  {pendingAddresses.map((req) => {
                    const meta = (req.metadata ?? {}) as AnyRecord;
                    return (
                      <div key={String(req._id ?? req.id)} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">{String(meta.label ?? "")}</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {String(meta.line1 ?? "")}, {String(meta.city ?? "")}
                          </p>
                          {meta.adminName ? <p className="text-xs text-slate-400 mt-0.5 dark:text-zinc-500">Assigned to: {String(meta.adminName)}</p> : null}
                        </div>
                        <Clock size={16} className="shrink-0 text-amber-500 dark:text-amber-400" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit form (only for authorized HR) */}
            {isAuthHr && (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-slate-500 dark:text-zinc-400" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Submit New Office Address</span>
                </div>

                {admins.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Assign to Admin *</label>
                    <select
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      value={selectedAdminId}
                      onChange={(e) => setSelectedAdminId(e.target.value)}
                    >
                      <option value="">Select admin</option>
                      {admins.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Region / Office Name *</label>
                    <input
                      type="text"
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      placeholder="e.g. Haldwani Office, North India Branch"
                      value={newAddrLabel}
                      onChange={(e) => setNewAddrLabel(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Address Line 1 *</label>
                    <input
                      type="text"
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      placeholder="Street, building"
                      value={newAddrLine1}
                      onChange={(e) => setNewAddrLine1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">City</label>
                    <input
                      type="text"
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      placeholder="City"
                      value={newAddrCity}
                      onChange={(e) => setNewAddrCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">State</label>
                    <input
                      type="text"
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      placeholder="State"
                      value={newAddrState}
                      onChange={(e) => setNewAddrState(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">ZIP / Postal Code</label>
                    <input
                      type="text"
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      placeholder="ZIP"
                      value={newAddrZip}
                      onChange={(e) => setNewAddrZip(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Country</label>
                    <input
                      type="text"
                      className="neu-inset w-full rounded-lg px-3 py-2 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                      placeholder="Country"
                      value={newAddrCountry}
                      onChange={(e) => setNewAddrCountry(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submittingAddr}
                  onClick={handleSubmitAddress}
                  className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium"
                >
                  <Send size={14} /> {submittingAddr ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
