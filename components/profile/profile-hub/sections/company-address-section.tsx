"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/client-utils";
import {
  Send,
  Clock,
  CheckCircle,
  MapPin,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserX,
  Users,
  Shield,
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  Building2,
  SlidersHorizontal,
  Info,
  Trash2,
} from "lucide-react";
import type { AnyRecord } from "../shared";
import { isMainOfficeRegion, mainOfficeLabelOf, regionManagerCaps } from "@/lib/company-regions";
import {
  Checkbox,
  ContactEditor,
  EmptyBlock,
  ModalShell,
  NumberField,
  Panel,
  SelectField,
  StatPill,
  StatusBadge,
  TabBar,
  TextField,
  type ContactDraft,
  type TabDef,
} from "./company-address-parts";

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

type AddressTab = "offices" | "add" | "limits";

function regionLabelOf(addr: AnyRecord): string {
  return String(addr.label ?? "").trim() || "Main Office";
}

function canManageRegion(
  addr: AnyRecord,
  role: string,
  mainLabel: string,
  userId: string,
): boolean {
  const isMainOfficeHr =
    role === "human-resource" &&
    (!mainLabel || String(addr.label ?? "").trim().toLowerCase() === mainLabel.toLowerCase());
  return (
    role === "admin" ||
    isMainOfficeHr ||
    staffIdsOf(addr.hrs).includes(userId) ||
    String(addr.hrHead ?? "") === userId
  );
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
  const [newAddrContacts, setNewAddrContacts] = useState<ContactDraft[]>([
    { name: "", phone: "", email: "", isPrimary: true }
  ]);
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
    isMainOfficeRegion(
      { addresses: (company?.addresses as AnyRecord[] | null) ?? [], address: String(company?.address ?? "") },
      { regionLabel: userRegionLabel ?? "" },
    );
  const canEditCaps = isAdmin || isMainOfficeHr;

  // Presentation-only state: which panel the modal is showing, and which region
  // (if any) has been drilled into for staffing management.
  const [tab, setTab] = useState<AddressTab>("offices");
  const [openRegion, setOpenRegion] = useState<string | null>(null);

  const drillAddress = openRegion
    ? approvedAddresses.find((a) => regionLabelOf(a) === openRegion) ?? null
    : null;

  const tabs = useMemo<TabDef<AddressTab>[]>(() => {
    const list: TabDef<AddressTab>[] = [
      {
        id: "offices",
        label: multiOffice ? "Offices" : "Overview",
        icon: Building2,
        count: pendingAddresses.length,
      },
    ];
    if (multiOffice && isAuthHr) {
      list.push({ id: "add", label: "Add Office", icon: MapPin });
    }
    if (multiOffice && (canEditCaps || (isAdmin && hrs.length > 0))) {
      list.push({ id: "limits", label: "Limits & Access", icon: SlidersHorizontal });
    }
    return list;
  }, [multiOffice, isAuthHr, canEditCaps, isAdmin, hrs.length, pendingAddresses.length]);

  // A tab can disappear when its precondition flips (mode turned off, access
  // revoked) while it is selected — fall back to the overview rather than
  // rendering nothing.
  const activeTab: AddressTab = tabs.some((t) => t.id === tab) ? tab : "offices";

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

    // Validate contacts
    const validContacts = newAddrContacts
      .filter((c) => c.name.trim().length > 0)
      .slice(0, 5);
    if (validContacts.length === 0) { showToast("At least one contact is required.", "error"); return; }
    const primaryCount = validContacts.filter((c) => c.isPrimary).length;
    if (primaryCount > 1) { showToast("Only one primary contact allowed.", "error"); return; }

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
          contacts: validContacts,
        }),
      });
      showToast("Address submitted for admin approval.", "success");
      setNewAddrLabel("");
      setNewAddrLine1("");
      setNewAddrCity("");
      setNewAddrState("");
      setNewAddrZip("");
      setNewAddrCountry("");
      setNewAddrContacts([{ name: "", phone: "", email: "", isPrimary: true }]);
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

const removeAddress = async (index: number) => {
    const next = approvedAddresses.filter((_, idx) => idx !== index);
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
  };

  const officeCards = approvedAddresses.map((addr, i) => {
    const label = regionLabelOf(addr);
    return (
      <OfficeCard
        key={`${label}-${i}`}
        addr={addr}
        canManage={canManageRegion(addr, role, mainLabel, userId)}
        onManage={() => setOpenRegion(label)}
        onDelete={isAdmin && approvedAddresses.length >= 2 ? () => removeAddress(i) : undefined}
      >
        <RegionStaffingBlock
          addr={addr}
          company={company}
          mainLabel={mainLabel}
          canEditCaps={canEditCaps}
          hrOptions={hrs}
          adminOptions={admins}
          showToast={showToast}
          refresh={refresh}
          drilled={false}
        />
      </OfficeCard>
    );
  });

  return (
    <ModalShell
      onClose={onClose}
      title="Office Address Management"
      description="Manage multi-office settings and submit new addresses."
      icon={MapPin}
      iconTone={multiOffice ? "indigo" : "amber"}
      headerExtra={
        isAdmin ? (
          <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-[var(--c-border-light)] bg-[var(--c-bg)] px-3 py-2 sm:flex dark:border-zinc-800 dark:bg-zinc-950/40">
            <span className="text-xs font-medium text-muted">Multi-office</span>
            <button
              type="button"
              disabled={toggling}
              onClick={handleToggleMultiOffice}
              title={
                multiOffice
                  ? "Disable multi-office mode"
                  : "Enable multi-office mode"
              }
              aria-label={
                multiOffice
                  ? "Disable multi-office mode"
                  : "Enable multi-office mode"
              }
              className="text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              {multiOffice ? (
                <ToggleRight
                  size={26}
                  className="text-indigo-600 dark:text-indigo-400"
                />
              ) : (
                <ToggleLeft size={26} />
              )}
            </button>
          </div>
        ) : undefined
      }
      footer={
        <>
          <p className="text-caption text-muted">
            {multiOffice
              ? `${approvedAddresses.length} approved office${approvedAddresses.length !== 1 ? "s" : ""}`
              : "Single office mode"}
            {pendingAddresses.length > 0
              ? ` · ${pendingAddresses.length} awaiting approval`
              : ""}
          </p>
          {activeTab === "add" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("offices")}
                className="neu-btn rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAddr}
                onClick={handleSubmitAddress}
                className="neu-btn neu-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                <Send size={15} />{" "}
                {submittingAddr ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="neu-btn rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-zinc-300"
            >
              Done
            </button>
          )}
        </>
      }
    >
      <TabBar
        tabs={tabs}
        active={activeTab}
        onChange={(id) => {
          setTab(id);
          if (id !== "offices") setOpenRegion(null);
        }}
      />

      {/* Offices / Overview */}
      {activeTab === "offices" && (
        <div className="space-y-5">
          {drillAddress ? (
            <OfficeCard
              addr={drillAddress}
              canManage={false}
              onManage={() => setOpenRegion(regionLabelOf(drillAddress))}
              onBack={() => setOpenRegion(null)}
            >
              <RegionStaffingBlock
addr={drillAddress}
                    company={company}
                    mainLabel={mainLabel}
                    canEditCaps={canEditCaps}
                    hrOptions={hrs}
                    adminOptions={admins}
                    showToast={showToast}
                    refresh={refresh}
                    drilled
                  />
            </OfficeCard>
          ) : (
            <>
              {!multiOffice && !isAdmin && (
                <Panel
                  icon={Info}
                  tone="warning"
                  title="Multi-office mode is disabled"
                  description="Contact your admin to enable it before you can submit office addresses for other regions."
                />
              )}

              {!multiOffice && singleOfficeEntry && (
                <Panel
                  icon={MapPin}
                  title={String(singleOfficeEntry.label ?? "").trim() || "Main Office"}
                  description={
                    [
                      String(singleOfficeEntry.line1 ?? ""),
                      String(singleOfficeEntry.city ?? ""),
                      String(singleOfficeEntry.state ?? ""),
                      String(singleOfficeEntry.country ?? ""),
                    ]
                      .filter(Boolean)
                      .join(", ") || String(company?.address ?? "")
                  }
                />
              )}

              {!multiOffice && legacyAddress && (
                <Panel
                  icon={MapPin}
                  title="Main Office"
                  description={legacyAddress}
                />
              )}

              {multiOffice &&
                (approvedAddresses.length === 0 ? (
                  <EmptyBlock
                    icon={Building2}
                    title="No approved offices yet"
                    description="Submitted office addresses show up here once an admin approves them."
                  />
                ) : (
                  officeCards
                ))}

              {multiOffice && pendingAddresses.length > 0 && (
                <Panel
                  icon={Clock}
                  tone="warning"
                  title={`Pending approval (${pendingAddresses.length})`}
                  description="Waiting for an admin to review these submissions."
                >
                  <div className="space-y-2.5">
                    {pendingAddresses.map((req) => {
                      const meta = (req.metadata ?? {}) as AnyRecord;
                      return (
                        <div
                          key={String(req._id ?? req.id)}
                          className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900/70 dark:bg-amber-950/25"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">
                              {String(meta.label ?? "")}
                            </p>
                            <p className="mt-0.5 text-caption text-slate-500 dark:text-zinc-400">
                              {[String(meta.line1 ?? ""), String(meta.city ?? "")].filter(Boolean).join(", ")}
                            </p>
                            {meta.adminName ? (
                              <p className="mt-1 text-caption text-slate-400 dark:text-zinc-500">
                                Assigned to: {String(meta.adminName)}
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge tone="warning" icon={Clock}>
                            Pending
                          </StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )}

              {multiOffice && !isAdmin && role === "human-resource" && !isAuthHr && (
                <Panel
                  icon={Info}
                  tone="subtle"
                  title="You cannot submit office addresses"
                  description="You are not authorized to submit office addresses. Contact your admin for access."
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Add Office */}
      {activeTab === "add" && isAuthHr && (
        <div className="space-y-5">
          <Panel
            icon={UserCheck}
            title="Approval Routing"
            description="Pick the admin who should review this request."
          >
            {admins.length > 0 ? (
              <div className="max-w-md">
                <SelectField
                  id="office-admin"
                  label="Assign to Admin"
                  required
                  hint="They will approve or reject the submitted address."
                  value={selectedAdminId}
                  onChange={setSelectedAdminId}
                >
                  <option value="">Select admin</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </SelectField>
              </div>
            ) : null}
          </Panel>

          <Panel
            icon={MapPin}
            title="Office Details"
            description="Where this office is located. Region name and street address are required."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="office-label"
                label="Region / Office Name"
                required
                className="sm:col-span-2"
                placeholder="e.g. Haldwani Office, North India Branch"
                value={newAddrLabel}
                onChange={setNewAddrLabel}
              />
              <TextField
                id="office-line1"
                label="Address Line 1"
                required
                className="sm:col-span-2"
                placeholder="Street, building"
                value={newAddrLine1}
                onChange={setNewAddrLine1}
              />
              <TextField
                id="office-city"
                label="City"
                placeholder="City"
                value={newAddrCity}
                onChange={setNewAddrCity}
              />
              <TextField
                id="office-state"
                label="State"
                placeholder="State"
                value={newAddrState}
                onChange={setNewAddrState}
              />
              <TextField
                id="office-zip"
                label="ZIP / Postal Code"
                placeholder="ZIP"
                value={newAddrZip}
                onChange={setNewAddrZip}
              />
              <TextField
                id="office-country"
                label="Country"
                placeholder="Country"
                value={newAddrCountry}
                onChange={setNewAddrCountry}
              />
            </div>
          </Panel>

          <Panel
            icon={Users}
            title="Office Contacts"
            description="Who should be contacted at this office."
          >
            <ContactEditor
              idPrefix="new-office"
              value={newAddrContacts}
              onChange={setNewAddrContacts}
            />
          </Panel>
        </div>
      )}

      {/* Limits & Access */}
      {activeTab === "limits" && (
        <div className="space-y-5">
          {canEditCaps && (
            <GlobalCapsEditor
              company={company}
              showToast={showToast}
              refresh={refresh}
            />
          )}

          {isAdmin && hrs.length > 0 && (
            <Panel
              icon={UserCheck}
              title="Authorized HR Managers"
              description="Select which HR members can submit office addresses."
            >
              <div className="space-y-2.5">
                {hrs.map((hr) => {
                  const isAuthorized = authorizedHrs.includes(hr.id);
                  return (
                    <div
                      key={hr.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--c-border-light)] bg-[var(--c-bg)] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {initialsOf(hr.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {hr.name}
                          </span>
                          <span className="block truncate text-caption text-muted">
                            {hr.email}
                          </span>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge
                          tone={isAuthorized ? "success" : "neutral"}
                          icon={isAuthorized ? UserCheck : UserX}
                        >
                          {isAuthorized ? "Authorized" : "Not authorized"}
                        </StatusBadge>
                        <button
                          type="button"
                          disabled={managingHr}
                          onClick={() => handleToggleHr(hr.id)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                            isAuthorized
                              ? "border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                              : "neu-btn text-indigo-600 dark:text-indigo-300"
                          }`}
                        >
                          {isAuthorized ? "Revoke" : "Authorize"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function OfficeCard({
  addr,
  canManage,
  onManage,
  onBack,
  onDelete,
  children,
}: {
  addr: AnyRecord;
  canManage: boolean;
  onManage: () => void;
  onBack?: () => void;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const label = regionLabelOf(addr);
  const address = [
    String(addr.line1 ?? ""),
    String(addr.city ?? ""),
    String(addr.state ?? ""),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--c-border-light)] bg-[var(--c-bg-card)] dark:border-zinc-800">
      {onBack ? (
        <div className="border-b border-[var(--c-border-light)] bg-[var(--c-bg)] px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ChevronLeft size={14} /> All offices
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300">
            <Building2 size={19} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-ink">{label}</h4>
            {address ? (
              <p className="mt-0.5 text-caption text-muted">{address}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={13} /> Delete
            </button>
          ) : null}
          <StatusBadge tone="success" icon={CheckCircle}>
            Approved
          </StatusBadge>
        </div>
      </div>

      <div className="px-5 pb-1">{children}</div>

      {canManage ? (
        <div className="mt-3 flex justify-end border-t border-[var(--c-border-light)] px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onManage}
            className="neu-btn inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
          >
            <Users size={14} /> Manage Staff
          </button>
        </div>
      ) : null}
    </section>
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
    <Panel
      icon={SlidersHorizontal}
      title="Region Staffing Limits (all regions)"
      description="Across every region, the maximum number of HRs and admins a region may hold. The main office can override per-region."
      action={
        <button
          type="button"
          disabled={saving}
          onClick={saveCaps}
          className="neu-btn neu-btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Global Caps"}
        </button>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          id="global-max-hrs"
          label="Max HRs"
          hint="Applies to every region without its own override."
          value={maxHrsStr}
          onChange={setMaxHrsStr}
        />
        <NumberField
          id="global-max-admins"
          label="Max Admins"
          hint="Applies to every region without its own override."
          value={maxAdminsStr}
          onChange={setMaxAdminsStr}
        />
      </div>
    </Panel>
  );
}

function staffIdsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v ?? "")).filter(Boolean) : [];
}

function PipelineAccessRow({
  label,
  isMainOffice,
  canDelegate,
  delegableOptions,
  currentHrHead,
  currentAdminHead,
  draft,
  saving,
  onToggle,
  onSave,
}: {
  label: string;
  isMainOffice: boolean;
  canDelegate: boolean;
  delegableOptions: { id: string; kind: "hr" | "admin"; name: string }[];
  currentHrHead: string;
  currentAdminHead: string;
  draft: string[];
  saving: boolean;
  onToggle: (id: string) => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const granted = draft.length > 0;
  const names = delegableOptions.filter((o) => draft.includes(o.id)).map((o) => o.name);

  // The main office has nothing to delegate — it already holds the authority — so
  // it says so rather than showing an empty panel that invites the reader to
  // wonder what they are meant to tick.
  if (isMainOffice) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle size={13} />
        Runs every region&apos;s requisitions
      </span>
    );
  }

  // A fragment, not a wrapper element: the caller is a `flex-wrap` row, and the
  // panel has to be a *direct* child of it to take the full width and wrap onto
  // its own line. Nesting it inside the trigger's span would pin it to the
  // trigger's inline box.
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => (canDelegate ? setOpen((v) => !v) : undefined)}
          title={
            canDelegate
              ? "Choose who at this region may raise requisitions and run the pipeline"
              : "Only the main office can grant pipeline access for this region"
          }
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors ${
            canDelegate
              ? "border border-[var(--c-border-light)] text-slate-700 hover:bg-[var(--c-bg-muted)] dark:border-zinc-700 dark:text-zinc-200"
              : "cursor-default border border-dashed text-slate-400 dark:text-zinc-500"
          }`}
        >
          {granted ? <UserCheck size={13} className="text-emerald-600" /> : <UserX size={13} />}
          {granted
            ? `Can create jobs: ${names.length === 1 ? names[0] : `${names.length} staff`}`
            : "Cannot create jobs"}
          {!canDelegate && <span className="font-normal">— main office only</span>}
          {canDelegate && (
            <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          )}
        </button>
      </span>

      {canDelegate && open && (
        <span className="block w-full rounded-lg border border-dashed border-slate-300 p-3 dark:border-zinc-800 dark:bg-[#0b0b0b]">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            Recruitment Pipeline — {label}
          </span>
          <span className="mt-0.5 block text-xs text-slate-400 dark:text-zinc-500">
            Tick this region&apos;s staff to let them raise requisitions and run ATS, assessments and
            interviews for <span className="font-medium text-slate-600 dark:text-zinc-300">{label}</span>.
            Without this they can only act on candidates once the main office distributes them here,
            and they always keep the offer and the join approval.
          </span>
          <span className="mt-2 block space-y-1.5">
            {delegableOptions.length === 0 && (
              <span className="block text-xs italic text-slate-400">
                Assign this region&apos;s HR or admin staff under Manage Staff first.
              </span>
            )}
            {delegableOptions.map((o) => (
              <label key={`${o.kind}-${o.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.includes(o.id)}
                  onChange={() => onToggle(o.id)}
                  className="accent-indigo-600"
                />
                <span className="text-slate-700 dark:text-zinc-200">{o.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {o.kind === "hr" ? "HR" : "Admin"}
                </span>
                {o.id === currentHrHead && <span className="text-[10px] text-indigo-500">HR head</span>}
                {o.id === currentAdminHead && <span className="text-[10px] text-emerald-600">Admin head</span>}
              </label>
            ))}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="mt-2 rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {saving ? "Saving..." : "Save Pipeline Access"}
          </button>
        </span>
      )}
    </>
  );
}

function RegionStaffingBlock({
  addr,
  company,
  mainLabel,
  canEditCaps,
  hrOptions,
  adminOptions,
  showToast,
  refresh,
  drilled = false,
}: {
  addr: AnyRecord;
  company: AnyRecord | null;
  mainLabel: string;
  canEditCaps: boolean;
  hrOptions: HrOption[];
  adminOptions: AdminOption[];
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: () => Promise<void>;
  drilled?: boolean;
}) {
  // The drill-in view mounts this block already opened, so the roster draft is
  // seeded up front. In the list view it stays null until the region is opened,
  // exactly as before.
  const [expanded, setExpanded] = useState(drilled);
  const [draft, setDraft] = useState<{ hrs: string[]; admins: string[]; hrHead: string; adminHead: string } | null>(() =>
    drilled
      ? {
          hrs: staffIdsOf(addr.hrs),
          admins: staffIdsOf(addr.admins),
          hrHead: String(addr.hrHead ?? ""),
          adminHead: String(addr.adminHead ?? ""),
        }
      : null,
  );
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

  // Pipeline delegation, saved on its own so granting it does not also rewrite
  // the staffing roster — a head who is ticked here but never given a seat on the
  // region's staff would hold a grant they cannot be removed from, and the two
  // lists answer different questions.
  const [pipelineDraft, setPipelineDraft] = useState<string[]>(staffIdsOf(addr.pipelineManagers));
  const [savingPipeline, setSavingPipeline] = useState(false);

  // Contacts management
  const currentContacts = Array.isArray(addr.contacts) ? addr.contacts : [];
  const [contactsDraft, setContactsDraft] = useState<{ name: string; phone: string; email: string; isPrimary: boolean }[]>(
    currentContacts.length > 0 ? currentContacts.map((c: any) => ({
      name: String(c.name ?? ""),
      phone: String(c.phone ?? ""),
      email: String(c.email ?? ""),
      isPrimary: Boolean(c.isPrimary),
    })) : [{ name: "", phone: "", email: "", isPrimary: true }]
  );
  const [savingContacts, setSavingContacts] = useState(false);

  // Only this region's own staff can be delegated. A company-wide picker would
  // let a head be granted authority over a region they do not work in, and the
  // grant is read off the region's own entry, so it would have no effect anyway.
  const delegableOptions = [
    ...currentHrs.map((id) => ({ id, kind: "hr" as const, name: nameOf(hrOptions, id) || "Unknown" })),
    ...currentAdmins.map((id) => ({ id, kind: "admin" as const, name: nameOf(adminOptions, id) || "Unknown" })),
  ].filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i);

  const togglePipelineManager = (id: string) => {
    setPipelineDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const savePipelineManagers = async () => {
    setSavingPipeline(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "set-pipeline-managers",
          label,
          pipelineManagers: pipelineDraft,
        }),
      });
      await refresh();
      showToast(
        pipelineDraft.length === 0
          ? "Pipeline access removed. Only the main office can run this region's requisitions."
          : "Pipeline access updated.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update pipeline access.", "error");
    } finally {
      setSavingPipeline(false);
    }
  };

  const saveContacts = async () => {
    const validContacts = contactsDraft
      .filter((c) => c.name.trim().length > 0)
      .slice(0, 5);
    if (validContacts.length === 0) { showToast("At least one contact is required.", "error"); return; }
    const primaryCount = validContacts.filter((c) => c.isPrimary).length;
    if (primaryCount > 1) { showToast("Only one primary contact allowed.", "error"); return; }

    setSavingContacts(true);
    try {
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "assign-region-managers",
          label,
          contacts: validContacts,
        }),
      });
      await refresh();
      showToast("Region contacts updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update contacts.", "error");
    } finally {
      setSavingContacts(false);
    }
  };

  const staffed = Boolean(currentHrHead && currentAdminHead);

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
      // In the drill-in view the panel is the page — collapsing it would leave
      // nothing to come back to. In the list it folds away as before.
      if (!drilled) {
        setExpanded(false);
        setDraft(null);
      }
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
    <div className="pb-4">
      {!staffed && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-caption text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            This region has no HR Head / Admin Head yet. Assign staff so it is
            fully operational.
          </span>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <StatPill
          icon={Users}
          tone="indigo"
          label="HR Head"
          value={nameOf(hrOptions, currentHrHead) || "Not assigned"}
          counter={`(${currentHrs.length}/${caps.maxHrs})`}
        />
        <StatPill
          icon={Shield}
          tone="emerald"
          label="Admin Head"
          value={nameOf(adminOptions, currentAdminHead) || "Not assigned"}
          counter={`(${currentAdmins.length}/${caps.maxAdmins})`}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-slate-600 dark:text-zinc-300">
        <PipelineAccessRow
          label={label}
          isMainOffice={label.toLowerCase() === mainLabel.toLowerCase()}
          canDelegate={canEditCaps}
          delegableOptions={delegableOptions}
          currentHrHead={currentHrHead}
          currentAdminHead={currentAdminHead}
          draft={pipelineDraft}
          saving={savingPipeline}
          onToggle={togglePipelineManager}
          onSave={savePipelineManagers}
        />
      </div>

      {expanded && draft && (
        <div className="mt-5 space-y-5 border-t border-[var(--c-border-light)] pt-5 dark:border-zinc-800">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              icon={Users}
              title={`HR Staff (max ${caps.maxHrs})`}
              description="Tick the HRs assigned to this region."
            >
              <div className="space-y-2">
                {hrOptions.length === 0 && (
                  <p className="text-caption italic text-muted">No HRs found.</p>
                )}
                {hrOptions.map((hr) => {
                  const checked = draft.hrs.includes(hr.id);
                  const disabled = !checked && draft.hrs.length >= caps.maxHrs;
                  return (
                    <label
                      key={hr.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 text-sm ${
                        disabled ? "opacity-40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleHr(hr.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                      />
                      <span className="text-slate-700 dark:text-zinc-200">
                        {hr.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4">
                <SelectField
                  id={`${label}-hr-head`}
                  label="HR Head"
                  value={draft.hrHead}
                  onChange={(v) => setDraft((d) => (d ? { ...d, hrHead: v } : d))}
                >
                  <option value="">Select...</option>
                  {draft.hrs.map((id) => (
                    <option key={id} value={id}>
                      {nameOf(hrOptions, id)}
                    </option>
                  ))}
                </SelectField>
              </div>
            </Panel>

            <Panel
              icon={Shield}
              title={`Admin Staff (max ${caps.maxAdmins})`}
              description="Tick the admins assigned to this region."
            >
              <div className="space-y-2">
                {adminOptions.length === 0 && (
                  <p className="text-caption italic text-muted">
                    No admins found.
                  </p>
                )}
                {adminOptions.map((adm) => {
                  const checked = draft.admins.includes(adm.id);
                  const disabled =
                    !checked && draft.admins.length >= caps.maxAdmins;
                  return (
                    <label
                      key={adm.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 text-sm ${
                        disabled ? "opacity-40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleAdmin(adm.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                      />
                      <span className="text-slate-700 dark:text-zinc-200">
                        {adm.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4">
                <SelectField
                  id={`${label}-admin-head`}
                  label="Admin Head"
                  value={draft.adminHead}
                  onChange={(v) =>
                    setDraft((d) => (d ? { ...d, adminHead: v } : d))
                  }
                >
                  <option value="">Select...</option>
                  {draft.admins.map((id) => (
                    <option key={id} value={id}>
                      {nameOf(adminOptions, id)}
                    </option>
                  ))}
                </SelectField>
              </div>
            </Panel>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5">
            <button
              type="button"
              disabled={savingContacts}
              onClick={saveContacts}
              className="neu-btn rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:text-zinc-300"
            >
              {savingContacts ? "Saving..." : "Save Contacts"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveStaffing}
              className="neu-btn neu-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Staff"}
            </button>
          </div>

          <Panel
            icon={Users}
            tone="subtle"
            title="Office Contacts"
            description="Contacts printed on ID cards for this office."
          >
            <ContactEditor
              idPrefix={`region-${label}`}
              value={contactsDraft}
              onChange={setContactsDraft}
            />
          </Panel>

          {canEditCaps && (
            <Panel
              icon={SlidersHorizontal}
              tone="subtle"
              title="Staffing Caps (main office)"
              description={`Company defaults: ${Number(company?.regionMaxHrs ?? 5)} HRs / ${Number(company?.regionMaxAdmins ?? 2)} admins per region. Override for this region only.`}
              action={
                <button
                  type="button"
                  disabled={savingCaps}
                  onClick={saveCaps}
                  className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:text-zinc-300"
                >
                  {savingCaps ? "Saving..." : "Save Caps"}
                </button>
              }
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <NumberField
                  id={`${label}-max-hrs`}
                  label="Max HRs"
                  disabled={usingDefaults}
                  value={capHrsStr}
                  onChange={setCapHrsStr}
                />
                <NumberField
                  id={`${label}-max-admins`}
                  label="Max Admins"
                  disabled={usingDefaults}
                  value={capAdminsStr}
                  onChange={setCapAdminsStr}
                />
              </div>
              <div className="mt-4">
                <Checkbox
                  id={`${label}-use-defaults`}
                  checked={usingDefaults}
                  onChange={setUsingDefaults}
                  label="Use company defaults"
                />
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
