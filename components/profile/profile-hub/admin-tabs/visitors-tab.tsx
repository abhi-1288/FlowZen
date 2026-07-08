"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, EmptyState, SectionHeader } from "../shared";
import { Modal } from "../modal";
import dynamic from "next/dynamic";

const IdCardModal = dynamic(
  () => import("../id-card-modal").then((mod) => mod.IdCardModal),
  { ssr: false },
);

type PassRecord = {
  _id: string;
  id: string;
  event?: string;
  company?: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorCompany: string;
  purpose: string;
  idDocumentUrl: string;
  hostName: string;
  status: string;
  approver?: string;
  validFrom?: string;
  validUntil?: string;
  isSigned: boolean;
  signedBy: string;
  signedRole: string;
  signedAt?: string;
  rejectionReason: string;
  identityCode: string;
  createdAt: string;
  region?: string;
  visitAddress?: string;
  timeIn?: string;
  timeOut?: string;
};

type EventRecord = {
  _id: string;
  id: string;
  slug: string;
  visitorCompany: string;
  expectedDate?: string;
  purpose: string;
  hostName: string;
  hostEmail: string;
  notes: string;
  status: string;
  createdAt: string;
};

export function VisitorsTab({
  company,
  showToast,
}: {
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const role = String(session?.user?.role ?? "");
  const isAdminHr = ["admin", "human-resource"].includes(role);
  const isSeniorSec = Boolean((session?.user as any)?.isSeniorSecurity);
  const canGenerate = role !== "employee" && (role !== "security" || isSeniorSec);

  /* ── Events ── */
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEventCompany, setNewEventCompany] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventPurpose, setNewEventPurpose] = useState("");
  const [newEventHostName, setNewEventHostName] = useState("");
  const [newEventHostEmail, setNewEventHostEmail] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  /* ── Passes ── */
  const [passes, setPasses] = useState<PassRecord[]>([]);
  const [passFilter, setPassFilter] = useState<string>("pending");

  /* ── Generate Pass ── */
  const [showGenerate, setShowGenerate] = useState(false);
  const [genName, setGenName] = useState("");
  const [genEmail, setGenEmail] = useState("");
  const [genPhone, setGenPhone] = useState("");
  const [genDate, setGenDate] = useState("");
  const [genTimeInTime, setGenTimeInTime] = useState("");
  const [genDuration, setGenDuration] = useState("4");
  const [genRegion, setGenRegion] = useState("");
  const [generating, setGenerating] = useState(false);

  const multiOffice = Boolean(company?.multiOffice);
  const regionOpts = multiOffice && Array.isArray(company?.addresses)
    ? (company.addresses as AnyRecord[]).map((a: AnyRecord) => String(a.label ?? "")).filter(Boolean)
    : company?.address ? ["Main Office"] : [];

  /* ── Preview / Sign ── */
  const [previewPass, setPreviewPass] = useState<PassRecord | null>(null);
  const [signing, setSigning] = useState(false);

  /* ── Decline ── */
  const [declineTarget, setDeclineTarget] = useState<PassRecord | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function loadEvents() {
    try {
      const data = await apiFetch<{ events: EventRecord[] }>("/api/hr/visitor/events");
      setEvents(data.events ?? []);
    } catch {
      /* ignore */
    }
  }

  async function loadPasses() {
    try {
      const data = await apiFetch<{ passes: PassRecord[] }>("/api/hr/visitor/passes");
      setPasses(data.passes ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadEvents();
    loadPasses();
  }, []);

  async function handleCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!newEventCompany) return;
    setCreatingEvent(true);
    try {
      await apiFetch("/api/hr/visitor/events", {
        method: "POST",
        body: JSON.stringify({
          visitorCompany: newEventCompany,
          expectedDate: newEventDate || null,
          purpose: newEventPurpose,
          hostName: newEventHostName,
          hostEmail: newEventHostEmail,
          notes: newEventNotes,
        }),
      });
      showToast("Visit notice created.");
      setShowCreateEvent(false);
      setNewEventCompany("");
      setNewEventDate("");
      setNewEventPurpose("");
      setNewEventHostName("");
      setNewEventHostEmail("");
      setNewEventNotes("");
      await loadEvents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create notice.", "error");
    } finally {
      setCreatingEvent(false);
    }
  }

  async function deleteEvent(id: string) {
    try {
      await apiFetch(`/api/hr/visitor/events/${id}`, { method: "DELETE" });
      showToast("Visit notice deleted.");
      await loadEvents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete.", "error");
    }
  }

  async function handleGeneratePass(e: FormEvent) {
    e.preventDefault();
    if (!genName || !genEmail) return;
    setGenerating(true);
    try {
      let timeIn: string | null = null;
      let timeOut: string | null = null;
      if (genDate && genTimeInTime) {
        timeIn = new Date(`${genDate}T${genTimeInTime}`).toISOString();
        const dur = parseInt(genDuration, 10);
        const ti = new Date(`${genDate}T${genTimeInTime}`);
        ti.setHours(ti.getHours() + dur);
        timeOut = ti.toISOString();
      }
      await apiFetch("/api/hr/visitor/passes", {
        method: "POST",
        body: JSON.stringify({
          visitorName: genName,
          visitorEmail: genEmail,
          visitorPhone: genPhone,
          timeIn,
          timeOut,
          region: genRegion,
        }),
      });
      showToast("Temporary visitor pass generated.");
      setShowGenerate(false);
      setGenName("");
      setGenEmail("");
      setGenPhone("");
      setGenDate("");
      setGenTimeInTime("");
      setGenDuration("4");
      setGenRegion("");
      await loadPasses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate pass.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmPass(pass: PassRecord) {
    const passId = pass.id || pass._id;
    setSigning(true);
    try {
      await apiFetch(`/api/hr/visitor/passes/${passId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      showToast("Visitor pass confirmed and identity code generated.");
      await loadPasses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Confirmation failed.", "error");
    } finally {
      setSigning(false);
    }
  }

  async function handleDecline() {
    if (!declineTarget) return;
    setDeclining(true);
    try {
      await apiFetch(`/api/hr/visitor/passes/${declineTarget.id || declineTarget._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          rejectionReason: declineReason,
        }),
      });
      setDeclineTarget(null);
      setDeclineReason("");
      showToast("Visitor pass declined.");
      await loadPasses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to decline.", "error");
    } finally {
      setDeclining(false);
    }
  }

  async function revokePass(pass: PassRecord) {
    try {
      await apiFetch(`/api/hr/visitor/passes/${pass.id || pass._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected", rejectionReason: "Revoked by HR." }),
      });
      showToast("Visitor pass revoked.");
      await loadPasses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to revoke.", "error");
    }
  }

  const filteredPasses = passes.filter((p) => passFilter === "all" || p.status === passFilter);

  const ambarAccent = { hex: "#d97706", dark: "#b45309", light: "#fef3c7" };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
      {/* ═══════════════ VISIT NOTICES ═══════════════ */}
      <SectionHeader title="Visit Notices" description="Post announcements for upcoming visits and generate registration links." accent="amber" />

      {isAdminHr ? (
        <div className="mb-4">
          <ActionButton variant="primary" onClick={() => setShowCreateEvent(true)}>
            + New Visit Notice
          </ActionButton>
        </div>
      ) : null}

      {events.length === 0 ? (
        <EmptyState message="No visit notices yet." />
      ) : (
        <div className="mb-8 space-y-3">
          {events.map((ev) => {
            const url = `${origin}/visit/${ev.slug}`;
            return (
              <div key={ev.id || ev._id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{ev.visitorCompany || "Unnamed"}</p>
                    <p className="text-xs text-slate-500">
                      {ev.purpose ? `${ev.purpose}` : "No purpose"}
                      {ev.expectedDate ? ` · ${new Date(ev.expectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </p>
                    {ev.hostName ? <p className="text-xs text-slate-400">Host: {ev.hostName}</p> : null}
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        value={url} readOnly onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-300"
                        onClick={() => { navigator.clipboard.writeText(url); showToast("Link copied!"); }}
                        type="button"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  {isAdminHr ? (
                    <button
                      className="shrink-0 text-xs font-medium text-rose-500 hover:text-rose-700"
                      onClick={() => deleteEvent(ev.id || ev._id)}
                      type="button"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════ VISITOR PASSES ═══════════════ */}
      <SectionHeader title="Visitor Passes" description={isAdminHr ? "Review, approve, or manage visitor registrations." : "View visitor registrations."} accent="amber" />

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {["pending", "approved", "expired", "rejected", "all"].map((f) => (
          <button
            key={f}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              passFilter === f
                ? "bg-amber-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => setPassFilter(f)}
            type="button"
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* ═══ Generate Pass Section ═══ */}
      {showGenerate ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Generate Temporary Visitor Pass</h3>
          <form onSubmit={handleGeneratePass} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Visitor Name *</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genName} onChange={(e) => setGenName(e.target.value)} required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
                <input type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genEmail} onChange={(e) => setGenEmail(e.target.value)} required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genPhone} onChange={(e) => setGenPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Office Region</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genRegion} onChange={(e) => setGenRegion(e.target.value)}
                >
                  <option value="">Select region</option>
                  {regionOpts.length > 0 ? regionOpts.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  )) : (
                    <option value="Main Office">Main Office</option>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
                <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genDate} onChange={(e) => setGenDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Time In</label>
                <input type="time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genTimeInTime} onChange={(e) => setGenTimeInTime(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Duration</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  value={genDuration} onChange={(e) => setGenDuration(e.target.value)}
                >
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="3">3 hours</option>
                  <option value="4">4 hours</option>
                  <option value="5">5 hours</option>
                  <option value="6">6 hours</option>
                  <option value="8">8 hours</option>
                  <option value="10">10 hours</option>
                  <option value="12">12 hours</option>
                </select>
              </div>
              {genDate && genTimeInTime ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Time Out</label>
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
                    {(() => {
                      const ti = new Date(`${genDate}T${genTimeInTime}`);
                      ti.setHours(ti.getHours() + parseInt(genDuration, 10));
                      return ti.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
                    })()}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Time Out</label>
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    —
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" type="button" onClick={() => { setShowGenerate(false); setGenName(""); setGenEmail(""); setGenPhone(""); setGenDate(""); setGenTimeInTime(""); setGenDuration("4"); setGenRegion(""); }}>
                Cancel
              </ActionButton>
              <ActionButton variant="primary" type="submit" disabled={generating}>
                {generating ? "Generating..." : "Generate Pass"}
              </ActionButton>
            </div>
          </form>
        </div>
      ) : canGenerate ? (
        <div className="mb-4">
          <ActionButton variant="primary" onClick={() => setShowGenerate(true)}>
            + Generate Temporary Pass
          </ActionButton>
        </div>
      ) : null}

      {filteredPasses.length === 0 ? (
        <EmptyState message="No visitor passes match this filter." />
      ) : (
        <div className="space-y-3">
          {filteredPasses.map((pass) => {
            const passId = pass.id || pass._id;
            const isPending = pass.status === "pending";
            const isApproved = pass.status === "approved";
            const isRejected = pass.status === "rejected";
            const isExpired = pass.status === "expired";
            const isActive = pass.status === "active";
            const isCompleted = pass.status === "completed";
            const statusColor = isPending ? "bg-amber-100 text-amber-700" :
              isApproved ? "bg-emerald-100 text-emerald-700" :
              isActive ? "bg-blue-100 text-blue-700" :
              isCompleted ? "bg-slate-100 text-slate-500" :
              isRejected ? "bg-rose-100 text-rose-700" :
              "bg-slate-100 text-slate-500";
            return (
              <div key={passId} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{pass.visitorName}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}>
                        {pass.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{pass.visitorEmail}</p>
                    {pass.visitorCompany ? <p className="text-xs text-slate-400">{pass.visitorCompany}</p> : null}
                    {pass.identityCode ? (
                      <p className="mt-0.5 text-[10px] font-mono text-slate-400">ID: {pass.identityCode}</p>
                    ) : null}
                    {pass.timeIn ? (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Time In: {new Date(pass.timeIn).toLocaleString("en-IN")}
                      </p>
                    ) : null}
                    {pass.timeOut ? (
                      <p className="text-[10px] text-slate-400">
                        Time Out: {new Date(pass.timeOut).toLocaleString("en-IN")}
                      </p>
                    ) : null}
                    {pass.region ? <p className="text-[10px] text-slate-400">Region: {pass.region}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {isPending && isAdminHr ? (
                      <>
                        <ActionButton variant="approve" className="px-3 py-1 text-xs" disabled={signing} onClick={() => handleConfirmPass(pass)}>
                          {signing ? "..." : "Confirm & Generate ID"}
                        </ActionButton>
                        <ActionButton variant="danger" className="px-3 py-1 text-xs" onClick={() => setDeclineTarget(pass)}>
                          Decline
                        </ActionButton>
                      </>
                    ) : null}
                    {isApproved ? (
                      <>
                        <ActionButton variant="secondary" className="px-3 py-1 text-xs" onClick={() => setPreviewPass(pass)}>
                          View Card
                        </ActionButton>
                        {isAdminHr ? (
                          <ActionButton variant="danger" className="px-3 py-1 text-xs" onClick={() => revokePass(pass)}>
                            Revoke
                          </ActionButton>
                        ) : null}
                      </>
                    ) : null}
                    {isActive || isCompleted ? (
                      <span className="px-3 py-1 text-xs text-slate-400">Scanned</span>
                    ) : null}
                    {isExpired || isRejected ? (
                      <span className="px-3 py-1 text-xs text-slate-400">{isExpired ? "Expired" : "Rejected"}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Create Event Modal ═══ */}
      <Modal open={showCreateEvent} onClose={() => setShowCreateEvent(false)}>
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">New Visit Notice</h3>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Visitor Company *</label>
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={newEventCompany} onChange={(e) => setNewEventCompany(e.target.value)} required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Expected Date</label>
            <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Purpose</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              rows={2} value={newEventPurpose} onChange={(e) => setNewEventPurpose(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Host Name</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={newEventHostName} onChange={(e) => setNewEventHostName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Host Email</label>
              <input type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={newEventHostEmail} onChange={(e) => setNewEventHostEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              rows={2} value={newEventNotes} onChange={(e) => setNewEventNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <ActionButton variant="secondary" type="button" onClick={() => setShowCreateEvent(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" disabled={creatingEvent}>
              {creatingEvent ? "Creating..." : "Create Notice"}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ═══ Decline Modal ═══ */}
      <Modal open={!!declineTarget} onClose={() => setDeclineTarget(null)}>
        <form onSubmit={(e) => { e.preventDefault(); handleDecline(); }} className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Decline Visit</h3>
          <p className="text-sm text-slate-500">Reason for declining {declineTarget?.visitorName}&apos;s visit:</p>
          <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            rows={3} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <ActionButton variant="secondary" type="button" onClick={() => setDeclineTarget(null)}>
              Cancel
            </ActionButton>
            <ActionButton variant="danger" type="submit" disabled={declining}>
              {declining ? "Declining..." : "Decline"}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ═══ Preview / ID Card Modal ═══ */}
      {previewPass ? (
        <IdCardModal
          open={!!previewPass}
          onClose={() => { setPreviewPass(null); }}
          profile={{
            name: previewPass.visitorName,
            email: previewPass.visitorEmail,
            phone: previewPass.visitorPhone,
            bloodGroup: "",
            emergencyContact: "",
            regionLabel: previewPass.region || "",
            companyIdentityCode: previewPass.identityCode || "",
            visitorCompany: previewPass.visitorCompany,
            purpose: previewPass.purpose,
            hostName: previewPass.hostName,
            idDocumentUrl: previewPass.idDocumentUrl,
            visitAddress: previewPass.visitAddress || "",
            validFrom: previewPass.validFrom,
            validUntil: previewPass.validUntil,
          }}
          company={null}
          avatarUrl=""
          displayName={previewPass.visitorName}
          displayRole="Visitor"
          signature={previewPass.isSigned ? { name: previewPass.signedBy, role: previewPass.signedRole, signedAt: previewPass.signedAt ?? "" } : null}
          issueDate={previewPass.validFrom ?? null}
          onSign={undefined}
          signerName={session?.user?.name ?? ""}
          signerRole={session?.user?.role ?? ""}
          variant="visitor"
        />
      ) : null}
    </section>
  );
}
