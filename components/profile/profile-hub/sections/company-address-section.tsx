"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import { Send, Clock, CheckCircle, MapPin, ToggleLeft, ToggleRight, UserCheck, UserX, Users, Shield, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { AnyRecord } from "../shared";
import { mainOfficeLabelOf, regionManagerCaps } from "@/lib/company-regions";

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
  userRegionLabel,
  showToast,
  refresh,
}: {
  company: AnyRecord | null;
  role: string;
  userId: string;
  userRegionLabel?: string;
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
          userRegionLabel={userRegionLabel ?? ""}
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
  userRegionLabel,
  showToast,
  refresh,
  onClose,
}: {
  company: AnyRecord | null;
  role: string;
  userId: string;
  userRegionLabel?: string;
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
  const singleOfficeEntry = !multiOffice && Array.isArray(company?.addresses) && (company.addresses as AnyRecord[]).length > 0
    ? (company.addresses as AnyRecord[])[0]
    : null;
  const legacyAddress = !multiOffice && !singleOfficeEntry && company?.address ? String(company.address).trim() : "";

  const isAuthHr = !isAdmin && role === "human-resource" && multiOffice
    && (company?.addressManagers as string[] ?? []).includes(userId);

  const mainLabel = mainOfficeLabelOf({ addresses: (company?.addresses as AnyRecord[] | null) ?? [], address: String(company?.address ?? "") });
  const isMainOfficeHr =
    role === "human-resource" &&
    !!multiOffice &&
    (!mainLabel || String(userRegionLabel ?? "").trim().toLowerCase() === mainLabel.toLowerCase());
  const canEditCaps = isAdmin || isMainOfficeHr;

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

    apiFetch<{ hrs: HrOption[] }>("/api/company/hrs")
      .then((data) => setHrs(data.hrs ?? []))
      .catch(() => {});

    if (isAdmin) {
      const managers = (company?.addressManagers as string[] ?? []).map((id: any) => String(id));
      setAuthorizedHrs(managers);
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

            {/* Global staffing caps (main office only) */}
            {canEditCaps && (
              <GlobalCapsEditor
                company={company}
                showToast={showToast}
                refresh={refresh}
              />
            )}

            {/* Approved offices */}
            {approvedAddresses.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Approved Offices</span>
                <div className="mt-2 space-y-2">
                  {approvedAddresses.map((addr, i) => (
                    <div key={i} className="rounded-lg border border-[var(--c-border-light)] dark:border-zinc-800 dark:bg-[#0b0b0b]">
                      <div className="flex items-center justify-between p-3">
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
                      <RegionStaffingBlock
                        addr={addr}
                        company={company}
                        role={role}
                        userId={userId}
                        mainLabel={mainLabel}
                        canEditCaps={canEditCaps}
                        hrOptions={hrs}
                        adminOptions={admins}
                        showToast={showToast}
                        refresh={refresh}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single office with a stored name/label */}
            {!multiOffice && singleOfficeEntry ? (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Office Address</span>
                <div className="mt-2 rounded-lg neu-inset/50 p-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{String(singleOfficeEntry.label ?? "").trim() || "Main Office"}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {[String(singleOfficeEntry.line1 ?? ""), String(singleOfficeEntry.city ?? ""), String(singleOfficeEntry.state ?? ""), String(singleOfficeEntry.country ?? "")].filter(Boolean).join(", ") || String(company?.address ?? "")}
                  </p>
                </div>
              </div>
            ) : null}

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

function nameOf(opts: { id: string; name: string }[], id: string): string {
  if (!id) return "";
  return opts.find((o) => o.id === id)?.name ?? id.slice(-6);
}

function GlobalCapsEditor({
  company,
  showToast,
  refresh,
}: {
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: () => Promise<void>;
}) {
  const [maxHrsStr, setMaxHrsStr] = useState(String(Number(company?.regionMaxHrs ?? 5)));
  const [maxAdminsStr, setMaxAdminsStr] = useState(String(Number(company?.regionMaxAdmins ?? 2)));
  const [saving, setSaving] = useState(false);

  const saveCaps = async () => {
    const maxHrs = Number(maxHrsStr);
    const maxAdmins = Number(maxAdminsStr);
    if (!Number.isFinite(maxHrs) || maxHrs < 1 || !Number.isFinite(maxAdmins) || maxAdmins < 1) {
      showToast("Max values must be at least 1.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({ mode: "set-region-caps", maxHrs, maxAdmins }),
      });
      await refresh();
      showToast("Global region caps updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update caps.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--c-border-light)] p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Region Staffing Limits (all regions)</span>
      <p className="text-xs text-slate-400 mt-0.5 dark:text-zinc-500">
        Across every region, the maximum number of HRs and admins a region may hold. The main office can override per-region.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Max HRs</span>
          <input
            type="number"
            min={1}
            className="mt-1 w-24 rounded-lg neu-inset px-2 py-1.5 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
            value={maxHrsStr}
            onChange={(e) => setMaxHrsStr(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Max Admins</span>
          <input
            type="number"
            min={1}
            className="mt-1 w-24 rounded-lg neu-inset px-2 py-1.5 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
            value={maxAdminsStr}
            onChange={(e) => setMaxAdminsStr(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={saveCaps}
          className="rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {saving ? "Saving..." : "Save Global Caps"}
        </button>
      </div>
    </div>
  );
}

function staffIdsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v ?? "")).filter(Boolean) : [];
}

function RegionStaffingBlock({
  addr,
  company,
  role,
  userId,
  mainLabel,
  canEditCaps,
  hrOptions,
  adminOptions,
  showToast,
  refresh,
}: {
  addr: AnyRecord;
  company: AnyRecord | null;
  role: string;
  userId: string;
  mainLabel: string;
  canEditCaps: boolean;
  hrOptions: HrOption[];
  adminOptions: AdminOption[];
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<{ hrs: string[]; admins: string[]; hrHead: string; adminHead: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [capHrsStr, setCapHrsStr] = useState(addr.maxHrs != null ? String(addr.maxHrs) : "");
  const [capAdminsStr, setCapAdminsStr] = useState(addr.maxAdmins != null ? String(addr.maxAdmins) : "");
  const [usingDefaults, setUsingDefaults] = useState(addr.maxHrs == null && addr.maxAdmins == null);
  const [savingCaps, setSavingCaps] = useState(false);

  const caps = regionManagerCaps(
    {
      regionMaxHrs: Number(company?.regionMaxHrs ?? 5),
      regionMaxAdmins: Number(company?.regionMaxAdmins ?? 2),
    },
    addr,
  );

  const currentHrs = staffIdsOf(addr.hrs);
  const currentAdmins = staffIdsOf(addr.admins);
  const currentHrHead = String(addr.hrHead ?? "");
  const currentAdminHead = String(addr.adminHead ?? "");
  const label = String(addr.label ?? "").trim() || "Main Office";

  const isMainOfficeHr =
    role === "human-resource" &&
    (!mainLabel || String(addr.label ?? "").trim().toLowerCase() === mainLabel.toLowerCase());
  const canManage =
    role === "admin" || isMainOfficeHr || currentHrs.includes(userId) || currentHrHead === userId;

  const staffed = Boolean(currentHrHead && currentAdminHead);

  const expand = () => {
    setDraft({
      hrs: currentHrs,
      admins: currentAdmins,
      hrHead: currentHrHead,
      adminHead: currentAdminHead,
    });
    setExpanded(true);
  };

  const toggleHr = (id: string) => {
    setDraft((d) => {
      if (!d) return d;
      const inList = d.hrs.includes(id);
      const nextHrs = inList
        ? d.hrs.filter((x) => x !== id)
        : d.hrs.length >= caps.maxHrs
          ? d.hrs
          : [...d.hrs, id];
      let hrHead = inList && d.hrHead === id ? "" : d.hrHead;
      if (hrHead && !nextHrs.includes(hrHead)) hrHead = "";
      if (!hrHead && nextHrs.length === 1) hrHead = nextHrs[0];
      return { ...d, hrs: nextHrs, hrHead };
    });
  };

  const toggleAdmin = (id: string) => {
    setDraft((d) => {
      if (!d) return d;
      const inList = d.admins.includes(id);
      const nextAdmins = inList
        ? d.admins.filter((x) => x !== id)
        : d.admins.length >= caps.maxAdmins
          ? d.admins
          : [...d.admins, id];
      let adminHead = inList && d.adminHead === id ? "" : d.adminHead;
      if (adminHead && !nextAdmins.includes(adminHead)) adminHead = "";
      if (!adminHead && nextAdmins.length === 1) adminHead = nextAdmins[0];
      return { ...d, admins: nextAdmins, adminHead };
    });
  };

  const saveStaffing = async () => {
    if (!draft) return;
    if (draft.hrs.length === 0 && currentHrs.length > 0) {
      showToast("A region must keep at least 1 assigned HR.", "error");
      return;
    }
    if (draft.admins.length === 0 && currentAdmins.length > 0) {
      showToast("A region must keep at least 1 assigned admin.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "assign-region-managers",
          label,
          hrIds: draft.hrs,
          adminIds: draft.admins,
          hrHeadId: draft.hrHead || undefined,
          adminHeadId: draft.adminHead || undefined,
        }),
      });
      await refresh();
      showToast("Region staff updated.", "success");
      setExpanded(false);
      setDraft(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update region staff.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveCaps = async () => {
    setSavingCaps(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "set-region-caps",
          label,
          useDefaults: usingDefaults,
          maxHrs: usingDefaults ? undefined : Number(capHrsStr) || null,
          maxAdmins: usingDefaults ? undefined : Number(capAdminsStr) || null,
        }),
      });
      await refresh();
      showToast("Region caps updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update caps.", "error");
    } finally {
      setSavingCaps(false);
    }
  };

  return (
    <div className="border-t border-[var(--c-border-light)] px-3 py-3 dark:border-zinc-800">
      {!staffed && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>This region has no HR Head / Admin Head yet. Assign staff so it is fully operational.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <Users size={13} className="text-indigo-500" />
          HR Head: <span className="font-medium text-slate-800 dark:text-zinc-100">{nameOf(hrOptions, currentHrHead) || "—"}</span>
          <span className="text-slate-400">({currentHrs.length}/{caps.maxHrs})</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Shield size={13} className="text-emerald-500" />
          Admin Head: <span className="font-medium text-slate-800 dark:text-zinc-100">{nameOf(adminOptions, currentAdminHead) || "—"}</span>
          <span className="text-slate-400">({currentAdmins.length}/{caps.maxAdmins})</span>
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => (expanded ? setExpanded(false) : expand())}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--c-border-light)] px-2 py-1 font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-zinc-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Close" : "Manage Staff"}
          </button>
        )}
      </div>

      {expanded && draft && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--c-border-light)] p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">HR Staff (max {caps.maxHrs})</span>
              <div className="mt-2 space-y-1.5">
                {hrOptions.length === 0 && <p className="text-xs text-slate-400 italic">No HRs found.</p>}
                {hrOptions.map((hr) => {
                  const checked = draft.hrs.includes(hr.id);
                  const disabled = !checked && draft.hrs.length >= caps.maxHrs;
                  return (
                    <label key={hr.id} className={`flex items-center gap-2 text-sm cursor-pointer ${disabled ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleHr(hr.id)}
                        className="accent-indigo-600"
                      />
                      <span className="text-slate-700 dark:text-zinc-200">{hr.name}</span>
                    </label>
                  );
                })}
              </div>
              <label className="mt-2 block">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">HR Head</span>
                <select
                  className="mt-1 w-full rounded-lg neu-inset px-2 py-1.5 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                  value={draft.hrHead}
                  onChange={(e) => setDraft((d) => (d ? { ...d, hrHead: e.target.value } : d))}
                >
                  <option value="">Select...</option>
                  {draft.hrs.map((id) => (
                    <option key={id} value={id}>{nameOf(hrOptions, id)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-[var(--c-border-light)] p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Admin Staff (max {caps.maxAdmins})</span>
              <div className="mt-2 space-y-1.5">
                {adminOptions.length === 0 && <p className="text-xs text-slate-400 italic">No admins found.</p>}
                {adminOptions.map((adm) => {
                  const checked = draft.admins.includes(adm.id);
                  const disabled = !checked && draft.admins.length >= caps.maxAdmins;
                  return (
                    <label key={adm.id} className={`flex items-center gap-2 text-sm cursor-pointer ${disabled ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleAdmin(adm.id)}
                        className="accent-emerald-600"
                      />
                      <span className="text-slate-700 dark:text-zinc-200">{adm.name}</span>
                    </label>
                  );
                })}
              </div>
              <label className="mt-2 block">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Admin Head</span>
                <select
                  className="mt-1 w-full rounded-lg neu-inset px-2 py-1.5 text-sm dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                  value={draft.adminHead}
                  onChange={(e) => setDraft((d) => (d ? { ...d, adminHead: e.target.value } : d))}
                >
                  <option value="">Select...</option>
                  {draft.admins.map((id) => (
                    <option key={id} value={id}>{nameOf(adminOptions, id)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={saveStaffing}
            className="neu-btn neu-btn-primary rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Staff"}
          </button>

          {canEditCaps && (
            <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">Staffing Caps (main office)</span>
              <p className="text-xs text-slate-400 mt-0.5 dark:text-zinc-500">
                Company defaults: {Number(company?.regionMaxHrs ?? 5)} HRs / {Number(company?.regionMaxAdmins ?? 2)} admins per region. Override for this region only.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Max HRs</span>
                  <input
                    type="number"
                    min={1}
                    disabled={usingDefaults}
                    className="mt-1 w-24 rounded-lg neu-inset px-2 py-1.5 text-sm disabled:opacity-40 dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                    value={capHrsStr}
                    onChange={(e) => setCapHrsStr(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Max Admins</span>
                  <input
                    type="number"
                    min={1}
                    disabled={usingDefaults}
                    className="mt-1 w-24 rounded-lg neu-inset px-2 py-1.5 text-sm disabled:opacity-40 dark:bg-[#000000] dark:text-zinc-100 dark:border-zinc-800"
                    value={capAdminsStr}
                    onChange={(e) => setCapAdminsStr(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600 dark:text-zinc-300">
                  <input type="checkbox" checked={usingDefaults} onChange={(e) => setUsingDefaults(e.target.checked)} className="accent-indigo-600" />
                  Use company defaults
                </label>
                <button
                  type="button"
                  disabled={savingCaps}
                  onClick={saveCaps}
                  className="rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {savingCaps ? "Saving..." : "Save Caps"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
