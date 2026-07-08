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

  // Show old single company.address when multi-office is off
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 border-indigo-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Office Address Management</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage multi-office settings and submit new addresses.
        </p>
      </div>

      {/* Multi-office toggle (admin only) */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Multiple offices in different regions</span>
          </div>
          <button
            type="button"
            disabled={toggling}
            onClick={handleToggleMultiOffice}
            className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
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
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Authorized HR Managers</span>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">Select which HR members can submit office addresses.</p>
              <div className="space-y-1.5">
                {hrs.map((hr) => {
                  const isAuthorized = authorizedHrs.includes(hr.id);
                  return (
                    <div key={hr.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isAuthorized ? <UserCheck size={14} className="text-emerald-500" /> : <UserX size={14} className="text-slate-300" />}
                        <span className="text-sm text-slate-700">{hr.name}</span>
                        <span className="text-xs text-slate-400">({hr.email})</span>
                      </div>
                      <button
                        type="button"
                        disabled={managingHr}
                        onClick={() => handleToggleHr(hr.id)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                          isAuthorized
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        } disabled:opacity-50`}
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
            <p className="text-sm text-slate-400 italic">You are not authorized to submit office addresses. Contact your admin for access.</p>
          )}

          {/* Approved offices */}
          {approvedAddresses.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approved Offices</span>
              <div className="mt-2 space-y-2">
                {approvedAddresses.map((addr, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{String(addr.label ?? "")}</p>
                      <p className="text-xs text-slate-500">
                        {[String(addr.line1 ?? ""), String(addr.city ?? ""), String(addr.state ?? "")].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {approvedAddresses.length >= 2 && isAdmin ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-500 hover:text-red-700"
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
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Office Address</span>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-sm font-medium text-slate-800">Main Office</p>
                <p className="text-xs text-slate-500">{legacyAddress}</p>
              </div>
            </div>
          )}

          {/* Pending submissions */}
          {pendingAddresses.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Approval</span>
              <div className="mt-2 space-y-2">
                {pendingAddresses.map((req) => {
                  const meta = (req.metadata ?? {}) as AnyRecord;
                  return (
                    <div key={String(req._id ?? req.id)} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{String(meta.label ?? "")}</p>
                        <p className="text-xs text-slate-500">
                          {String(meta.line1 ?? "")}, {String(meta.city ?? "")}
                        </p>
                        {meta.adminName ? <p className="text-xs text-slate-400 mt-0.5">Assigned to: {String(meta.adminName)}</p> : null}
                      </div>
                      <Clock size={16} className="shrink-0 text-amber-500" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit form (only for authorized HR) */}
          {isAuthHr && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Submit New Office Address</span>
              </div>

              {admins.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Assign to Admin *</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
                  <label className="mb-1 block text-xs font-medium text-slate-500">Region / Office Name *</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="e.g. Haldwani Office, North India Branch"
                    value={newAddrLabel}
                    onChange={(e) => setNewAddrLabel(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Address Line 1 *</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Street, building"
                    value={newAddrLine1}
                    onChange={(e) => setNewAddrLine1(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">City</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="City"
                    value={newAddrCity}
                    onChange={(e) => setNewAddrCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">State</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="State"
                    value={newAddrState}
                    onChange={(e) => setNewAddrState(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">ZIP / Postal Code</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="ZIP"
                    value={newAddrZip}
                    onChange={(e) => setNewAddrZip(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Country</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send size={14} /> {submittingAddr ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
