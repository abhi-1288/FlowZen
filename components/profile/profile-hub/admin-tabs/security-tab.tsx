"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Html5Qrcode } from "html5-qrcode";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, SectionHeader } from "../shared";

type ActiveSection = "verify" | "scan" | "visitors" | "lost-cards" | "entry-logs" | "emergency";

const SECTIONS: { key: ActiveSection; label: string }[] = [
  { key: "verify", label: "Verify Employee" },
  { key: "scan", label: "Scan QR" },
  { key: "visitors", label: "Visitor Management" },
  { key: "entry-logs", label: "Entry Logs" },
  { key: "lost-cards", label: "Lost Card Reports" },
  { key: "emergency", label: "Emergency Contacts" },
];

type ScanResult = {
  type: "employee" | "visitor" | "not-found";
  hasActiveEntry?: boolean;
  isProcessed?: boolean;
  data: AnyRecord | null;
};

type EntryLogRecord = {
  id: string;
  user: AnyRecord | null;
  type: string;
  method: string;
  timestamp: string;
  recordedBy: AnyRecord | null;
};

type TimelineEntry = {
  action: string;
  actor: string;
  actorName: string;
  timestamp: string;
  notes: string;
};

type LostCardRecord = {
  id: string;
  user: AnyRecord | null;
  reportedBy: AnyRecord | null;
  reportedByEmployee: boolean;
  status: string;
  reason: string;
  lastLocation: string;
  lostDateTime: string | null;
  policeComplaintNumber: string;
  isEmergency: boolean;
  notes: string;
  verifiedBy: AnyRecord | null;
  verifiedAt: string | null;
  verificationNotes: string;
  approvedBy: AnyRecord | null;
  approvedAt: string | null;
  cardDisabledBy: AnyRecord | null;
  cardDisabledAt: string | null;
  disabledZones: string[];
  hrApprovedBy: AnyRecord | null;
  hrApprovedAt: string | null;
  newCardNumber: string;
  newRfidUid: string;
  issueDate: string | null;
  expiryDate: string | null;
  printedBy: AnyRecord | null;
  printedAt: string | null;
  collectedAt: string | null;
  collectedBy: AnyRecord | null;
  collectionVerificationMethod: string;
  assignedSecurity: AnyRecord | null;
  expectedCompletion: string | null;
  oldCardFound: boolean;
  replacementAlreadyIssued: boolean;
  oldCardDestroyed: boolean;
  rejectionReason: string;
  rejectedBy: AnyRecord | null;
  rejectedAt: string | null;
  assignedSeniorSecurity: AnyRecord | null;
  assignedHR: AnyRecord | null;
  seniorTicketOpened: boolean;
  seniorTicketOpenedBy: AnyRecord | null;
  seniorTicketOpenedAt: string | null;
  assignedJuniorSecurity: AnyRecord | null;
  juniorAcceptedAt: string | null;
  followUpNotes: { note: string; addedBy: AnyRecord | null; addedByName: string; addedAt: string }[];
  juniorCompletedAt: string | null;
  timeline: TimelineEntry[];
  reportedAt: string;
};

type PassRecord = {
  id: string;
  _id: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorCompany: string;
  purpose: string;
  hostName: string;
  status: string;
  validFrom: string;
  validUntil: string;
  identityCode: string;
  timeIn?: string;
  timeOut?: string;
};

type EmergencyContact = {
  id: string;
  name: string;
  email: string;
  role: string;
  emergencyContact: string;
  phone: string;
  bloodGroup: string;
  regionLabel: string;
};

export function SecurityTab({ company, showToast }: { company: AnyRecord | null; showToast: (text: string, type?: "success" | "error") => void }) {
  const { data: session } = useSession();
  const isSenior = session?.user?.role === "admin" || session?.user?.role === "human-resource" || Boolean((session?.user as any)?.isSeniorSecurity);
  const role = String(session?.user?.role ?? "");

  const [activeSection, setActiveSection] = useState<ActiveSection>("verify");

  // ── Verify Employee ──
  const [verifyQuery, setVerifyQuery] = useState("");
  const [verifyResult, setVerifyResult] = useState<AnyRecord | null>(null);
  const [verifying, setVerifying] = useState(false);

  // ── Scan QR ──
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loggingEntry, setLoggingEntry] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // ── Visitors ──
  const [passes, setPasses] = useState<PassRecord[]>([]);
  const [passFilter, setPassFilter] = useState("approved");

  // ── Entry Logs ──
  const [entryLogs, setEntryLogs] = useState<EntryLogRecord[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logType, setLogType] = useState("");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ── Lost Cards ──
  const [lostCards, setLostCards] = useState<LostCardRecord[]>([]);
  const [lostCardFilter, setLostCardFilter] = useState("");
  const [updatingCard, setUpdatingCard] = useState<string | null>(null);
  const [foundPopup, setFoundPopup] = useState<{ id: string; show: boolean }>({ id: "", show: false });
  const [disableAccessPopup, setDisableAccessPopup] = useState<{ id: string; show: boolean }>({ id: "", show: false });
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [completeTicketPopup, setCompleteTicketPopup] = useState<{ id: string; show: boolean }>({ id: "", show: false });
  const [completeTicketNote, setCompleteTicketNote] = useState("");
  const [printCardPopup, setPrintCardPopup] = useState<{ id: string; show: boolean }>({ id: "", show: false });
  const [printCardNumber, setPrintCardNumber] = useState("");
  const [printRfidUid, setPrintRfidUid] = useState("");
  const [printExpiryDate, setPrintExpiryDate] = useState("");
  const [rejectPopup, setRejectPopup] = useState<{ id: string; show: boolean }>({ id: "", show: false });
  const [rejectReason, setRejectReason] = useState("");
  const [verifyPopup, setVerifyPopup] = useState<{ id: string; show: boolean }>({ id: "", show: false });
  const [highlightedCard, setHighlightedCard] = useState<string | null>(null);

  // ── Emergency Contacts ──
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // ── Verify Employee ──
  async function handleVerify() {
    const q = verifyQuery.trim().toLowerCase();
    if (!q) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await apiFetch<{ members: AnyRecord[] }>(`/api/hr/security/members?search=${encodeURIComponent(q)}`);
      setVerifyResult(res.members?.[0] ?? null);
      if (!res.members?.length) showToast("No employee found.", "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Verification failed.", "error");
    } finally {
      setVerifying(false);
    }
  }

  // ── Scan QR ──
  function resetScan() {
    setScanResult(null);
    setShowManualEntry(false);
    setCameraUnavailable(false);
    setScanCode("");
    if (activeSection === "scan") handleStartCamera();
  }

  async function handleScanWithCode(code: string) {
    if (!code) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiFetch<ScanResult>("/api/hr/security/scan", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setScanResult(res);
      if (res.type === "not-found") {
        showToast("No match found for this code.", "error");
      } else if (res.isProcessed) {
        showToast("This pass has already been used.", "error");
      } else if (res.hasActiveEntry) {
        showToast("Already logged in — logging exit.");
        await logEntryWithCode(code, "exit");
        resetScan();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scan failed.", "error");
    } finally {
      setScanning(false);
    }
  }

  async function handleScan() {
    await handleScanWithCode(scanCode.trim().toUpperCase());
  }

  // ── Camera QR Scanner ──
  useEffect(() => {
    if (activeSection !== "scan") {
      try { scannerRef.current?.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
      setCameraReady(false);
      setShowManualEntry(false);
      setCameraUnavailable(false);
      setCameraStarting(false);
    }
  }, [activeSection]);

  async function handleStartCamera() {
    setCameraStarting(true);
    setCameraUnavailable(false);

    // Pre-grant camera permission — getUserMedia must be initiated synchronously
    // within the user-gesture context (iOS requirement). Doing this before the
    // html5-qrcode scanner start ensures permission is already granted when the
    // library internally calls getUserMedia.
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      tempStream.getTracks().forEach(t => t.stop());
    } catch {
      setCameraUnavailable(true);
      setShowManualEntry(true);
      setCameraStarting(false);
      return;
    }

    const scanner = new Html5Qrcode("qr-reader");
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try { scanner.stop(); } catch { /* ignore */ }
          let code = "";
          try {
            const urlObj = new URL(decodedText);
            const segments = urlObj.pathname.split("/").filter(Boolean);
            code = segments[segments.length - 1] || "";
          } catch {
            code = decodedText;
          }
          if (code) {
            setScanCode(code.toUpperCase());
            handleScanWithCode(code.toUpperCase());
          }
        },
        () => {},
      );
      scannerRef.current = scanner;
      setCameraReady(true);
      setCameraStarting(false);
    } catch {
      setCameraUnavailable(true);
      setShowManualEntry(true);
      setCameraStarting(false);
    }
  }

  async function logEntryWithCode(code: string, type: "entry" | "exit") {
    await apiFetch("/api/hr/security/entry-logs", {
      method: "POST",
      body: JSON.stringify({ code, type }),
    });
  }

  async function logEntry(type: "entry" | "exit") {
    if (!scanResult?.data) return;
    setLoggingEntry(true);
    try {
      await logEntryWithCode(scanCode.trim().toUpperCase(), type);
      showToast(`${type === "entry" ? "Entry" : "Exit"} logged.`);
      resetScan();
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to log ${type}.`, "error");
    } finally {
      setLoggingEntry(false);
    }
  }

  // ── Visitors ──
  async function loadPasses() {
    try {
      const res = await apiFetch<{ passes: PassRecord[] }>("/api/hr/visitor/passes");
      setPasses(res.passes ?? []);
    } catch {
      /* ignore */
    }
  }

  // ── Entry Logs ──
  async function loadEntryLogs() {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({ page: String(logPage), limit: "10" });
      if (logType) params.set("type", logType);
      if (logFrom) params.set("from", new Date(logFrom).toISOString());
      if (logTo) params.set("to", new Date(logTo + "T23:59:59").toISOString());
      const res = await apiFetch<{ logs: EntryLogRecord[]; pagination: { page: number; totalPages: number } }>(
        `/api/hr/security/entry-logs?${params.toString()}`
      );
      setEntryLogs(res.logs ?? []);
      setLogTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      /* ignore */
    } finally {
      setLoadingLogs(false);
    }
  }

  // ── Lost Cards ──
  async function loadLostCards() {
    try {
      const params = new URLSearchParams();
      if (lostCardFilter) params.set("status", lostCardFilter);
      const res = await apiFetch<{ reports: LostCardRecord[] }>(`/api/hr/security/lost-cards?${params.toString()}`);
      setLostCards(res.reports ?? []);
    } catch {
      /* ignore */
    }
  }

  async function updateCardStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...extra }),
      });
      showToast(`Status updated to "${status}".`);
      setHighlightedCard(id);
      setTimeout(() => setHighlightedCard(null), 1500);
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "error");
    } finally {
      setUpdatingCard(null);
    }
  }

  async function handleDisableAccess(id: string, zones: string[]) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}/disable-access`, {
        method: "POST",
        body: JSON.stringify({ zones }),
      });
      showToast("Building access disabled.");
      setDisableAccessPopup({ id: "", show: false });
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to disable access.", "error");
    } finally {
      setUpdatingCard(null);
    }
  }

  async function handleFoundCard(id: string, replacementAlreadyIssued: boolean) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}/found`, {
        method: "POST",
        body: JSON.stringify({ replacementAlreadyIssued }),
      });
      showToast("Card marked as found.");
      setFoundPopup({ id: "", show: false });
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed.", "error");
    } finally {
      setUpdatingCard(null);
    }
  }

  async function handleOpenTicket(id: string) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}/open-ticket`, { method: "POST" });
      showToast("Ticket opened.");
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to open ticket.", "error");
    } finally {
      setUpdatingCard(null);
    }
  }

  async function handleAcceptTicket(id: string) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}/accept-ticket`, { method: "POST" });
      showToast("Ticket accepted.");
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to accept ticket.", "error");
    } finally {
      setUpdatingCard(null);
    }
  }

  async function handleCompleteTicket(id: string) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}/complete-ticket`, {
        method: "POST",
        body: JSON.stringify({ note: completeTicketNote }),
      });
      showToast("Ticket completed.");
      setCompleteTicketPopup({ id: "", show: false });
      setCompleteTicketNote("");
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to complete ticket.", "error");
    } finally {
      setUpdatingCard(null);
    }
  }

  // ── Emergency Contacts ──
  async function loadEmergencyContacts() {
    setLoadingContacts(true);
    try {
      const res = await apiFetch<{ contacts: EmergencyContact[] }>("/api/hr/security/emergency-contacts");
      setEmergencyContacts(res.contacts ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingContacts(false);
    }
  }

  // ── Effects ──
  useEffect(() => {
    if (activeSection === "visitors") loadPasses();
    if (activeSection === "entry-logs") loadEntryLogs();
    if (activeSection === "lost-cards") loadLostCards();
    if (activeSection === "emergency") loadEmergencyContacts();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "entry-logs") loadEntryLogs();
  }, [logPage, logType]);

  useEffect(() => {
    if (activeSection === "lost-cards") loadLostCards();
  }, [lostCardFilter]);

  const filteredPasses = passes.filter((p) => passFilter === "all" || p.status === passFilter);

  const passCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of passes) {
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    }
    return counts;
  }, [passes]);

  const logCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of entryLogs) {
      counts[log.type] = (counts[log.type] ?? 0) + 1;
    }
    return counts;
  }, [entryLogs]);

  const cardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of lostCards) {
      counts[card.status] = (counts[card.status] ?? 0) + 1;
    }
    return counts;
  }, [lostCards]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      reported: "bg-amber-100 text-amber-700",
      "under-verification": "bg-blue-100 text-blue-700",
      "replacement-approved": "bg-indigo-100 text-indigo-700",
      "card-disabled": "bg-rose-100 text-rose-700",
      "hr-approved": "bg-purple-100 text-purple-700",
      printing: "bg-cyan-100 text-cyan-700",
      "ready-for-pickup": "bg-emerald-100 text-emerald-700",
      completed: "bg-slate-100 text-slate-600",
      rejected: "bg-red-100 text-red-700",
      found: "bg-teal-100 text-teal-700",
      "found-after-replacement": "bg-orange-100 text-orange-700",
    };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[status] ?? "bg-slate-100 text-slate-500"}`}>{status.replace("-", " ")}</span>;
  };

  const REPLACEMENT_STEPS = [
    { status: "reported", label: "Reported" },
    { status: "under-verification", label: "Verified" },
    { status: "replacement-approved", label: "Approved" },
    { status: "card-disabled", label: "Access Off" },
    { status: "hr-approved", label: "HR OK" },
    { status: "printing", label: "Printing" },
    { status: "ready-for-pickup", label: "Ready" },
    { status: "completed", label: "Done" },
  ];

  function nextActionHint(card: AnyRecord): string {
    const status = String(card.status ?? "");
    const terminal = ["rejected", "found", "found-after-replacement", "completed"];
    if (terminal.includes(status)) return "Workflow complete.";

    if (status === "reported" && !card.seniorTicketOpened) {
      if (role === "security" && !isSenior) return "Ask a senior security member or HR to open a ticket for this report.";
      return "Open a ticket to assign a junior security investigator, then verify the report.";
    }
    if (card.seniorTicketOpened && !card.assignedJuniorSecurity) {
      if (role === "security" && !isSenior) return "Accept this ticket to begin your investigation.";
      return "Waiting for a junior security member to accept the ticket.";
    }
    if (card.assignedJuniorSecurity && !card.juniorCompletedAt) {
      if (role === "security" && !isSenior) return "Complete your investigation with a follow-up note above.";
      return "Junior security is investigating. You can verify the report when ready.";
    }

    const hintsByRole: Record<string, Record<string, string>> = {
      reported: {
        "security": "Verify the report to proceed with replacement.",
        default: "Verify the report to proceed with replacement. Or mark as Found if card recovered.",
      },
      "under-verification": {
        default: "Approve the replacement card issuance. Or reject if not valid.",
      },
      "replacement-approved": {
        "security": "Disable building access zones for the old card.",
        default: "Disable building access zones for the old card.",
      },
      "card-disabled": {
        "human-resource": "Approve the replacement before printing.",
        default: "HR approval required before printing new card.",
      },
      "hr-approved": {
        default: "Print the new card with RFID details.",
      },
      printing: {
        default: "Mark as ready for pickup once card is at the security desk.",
      },
      "ready-for-pickup": {
        default: "Mark as collected after employee picks up the card.",
      },
    };
    const roleHints = hintsByRole[status];
    if (!roleHints) return "";
    return roleHints[role] ?? roleHints.default ?? "";
  }

  function sectionLabel(s: (typeof SECTIONS)[number]) {
    let count: number | null = null;
    if (s.key === "visitors" && passes.length) count = passes.length;
    else if (s.key === "entry-logs" && entryLogs.length) count = entryLogs.length;
    else if (s.key === "lost-cards" && lostCards.length) count = lostCards.length;
    return count ? `${s.label} (${count})` : s.label;
  }

  const sectionNav = (
    <div className="mb-6 flex flex-wrap gap-2">
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeSection === s.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setActiveSection(s.key)}
          type="button"
        >
          {sectionLabel(s)}
        </button>
      ))}
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader title="Security Dashboard" description="Verify identities, manage visitors, and monitor premises." accent="indigo" />
      {sectionNav}

      {/* ═══════════════ VERIFY EMPLOYEE ═══════════════ */}
      {activeSection === "verify" ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Verify Employee ID</h3>
          <div className="mb-4 flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Search by name, email, or identity code..."
              value={verifyQuery}
              onChange={(e) => setVerifyQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
            />
            <ActionButton variant="primary" disabled={verifying} onClick={handleVerify}>
              {verifying ? "Searching..." : "Verify"}
            </ActionButton>
          </div>
          {verifyResult ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                  {String((verifyResult as any).name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{String((verifyResult as any).name ?? "")}</p>
                  <p className="text-sm text-slate-500">{String((verifyResult as any).email ?? "")}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {String((verifyResult as any).role ?? "")}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      String((verifyResult as any).companyStatus) === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {String((verifyResult as any).companyStatus ?? "")}
                    </span>
                    {(verifyResult as any).companyIdentityCode ? (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                        ID: {String((verifyResult as any).companyIdentityCode)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ═══════════════ SCAN QR ═══════════════ */}
      {activeSection === "scan" ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Scan QR / Identity Code</h3>

          {scanResult ? (
            <div>
              {scanResult.data ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  {scanResult.type === "employee" ? (
                    <div>
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                          {String(scanResult.data.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{String(scanResult.data.name ?? "")}</p>
                          <p className="text-sm text-slate-500">{String(scanResult.data.email ?? "")}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {String(scanResult.data.role ?? "")}
                            </span>
                            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                              String(scanResult.data.companyStatus) === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {String(scanResult.data.companyStatus ?? "")}
                            </span>
                            {scanResult.data.bloodGroup ? (
                              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                                Blood: {String(scanResult.data.bloodGroup)}
                              </span>
                            ) : null}
                            {scanResult.data.regionLabel ? (
                              <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                                {String(scanResult.data.regionLabel)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <ActionButton variant="approve" className="px-4" disabled={loggingEntry} onClick={() => logEntry("entry")}>
                          Log Entry
                        </ActionButton>
                        <ActionButton variant="danger" className="px-4" disabled={loggingEntry} onClick={() => logEntry("exit")}>
                          Log Exit
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div>
                        <p className="font-semibold text-slate-900">{String(scanResult.data.visitorName ?? "")}</p>
                        <p className="text-sm text-slate-500">{String(scanResult.data.visitorEmail ?? "")}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                            String(scanResult.data.status) === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : String(scanResult.data.status) === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                          }`}>
                            {String(scanResult.data.status ?? "")}
                          </span>
                          {scanResult.data.visitorCompany ? (
                            <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                              {String(scanResult.data.visitorCompany)}
                            </span>
                          ) : null}
                          {scanResult.data.purpose ? (
                            <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                              {String(scanResult.data.purpose)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Host: {String(scanResult.data.hostName || "N/A")}</p>
                      </div>
                      {scanResult.isProcessed ? (
                        <p className="mt-3 text-xs text-amber-600">This pass has already been used.</p>
                      ) : String(scanResult.data.status) === "approved" || String(scanResult.data.status) === "active" ? (
                        <div className="mt-4 flex gap-2">
                          <ActionButton variant="approve" className="px-4" disabled={loggingEntry} onClick={() => logEntry("entry")}>
                            Log Entry
                          </ActionButton>
                          <ActionButton variant="danger" className="px-4" disabled={loggingEntry} onClick={() => logEntry("exit")}>
                            Log Exit
                          </ActionButton>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-amber-600">Pass is not approved. Cannot log entry.</p>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
                    <ActionButton variant="secondary" onClick={resetScan}>
                      Scan Another
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-slate-500">No match found for this code.</p>
                  <ActionButton variant="secondary" onClick={resetScan}>
                    Try Again
                  </ActionButton>
                </div>
              )}
            </div>
          ) : showManualEntry ? (
            <div>
              <div className="mb-4 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Enter identity code manually..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
                />
                <ActionButton variant="primary" disabled={scanning} onClick={handleScan}>
                  {scanning ? "Scanning..." : "Scan"}
                </ActionButton>
              </div>
              {!cameraUnavailable ? (
                <button
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => { setShowManualEntry(false); handleStartCamera(); }}
                  type="button"
                >
                  Use Camera Instead
                </button>
              ) : (
                <p className="text-xs text-slate-500">Camera unavailable — enter code manually.</p>
              )}
            </div>
          ) : (
            <div>
              <div className="relative mx-auto max-w-sm">
                <div
                  id="qr-reader"
                  className="min-h-[180px] rounded-xl border border-slate-200"
                />
                {!cameraReady ? (
                  <div
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-white"
                    onClick={cameraStarting ? undefined : handleStartCamera}
                  >
                    <span className="text-sm font-medium text-slate-600">
                      {cameraStarting ? "Starting camera..." : "Tap to Start Camera"}
                    </span>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">
                Point camera at a QR code
              </p>
              <div className="mt-3 text-center">
                <button
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => { try { scannerRef.current?.stop(); } catch {} setShowManualEntry(true); }}
                  type="button"
                >
                  Enter code manually
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ═══════════════ VISITOR MANAGEMENT ═══════════════ */}
      {activeSection === "visitors" ? (
        <div>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Today&apos;s Visitors</h3>

          <div className="mb-4 flex gap-2">
              {["approved", "pending", "expired", "rejected", "all"].map((f) => (
                <button
                  key={f}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    passFilter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => setPassFilter(f)}
                  type="button"
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}{f !== "all" && passCounts[f] ? ` (${passCounts[f]})` : ""}
                </button>
              ))}
          </div>

          {filteredPasses.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No visitor passes match this filter.</p>
          ) : (
            <div className="space-y-3">
              {filteredPasses.map((pass) => (
                <div key={pass.id || pass._id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{pass.visitorName}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          pass.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                          pass.status === "pending" ? "bg-amber-100 text-amber-700" :
                          pass.status === "active" ? "bg-blue-100 text-blue-700" :
                          pass.status === "completed" ? "bg-slate-100 text-slate-500" :
                          pass.status === "expired" ? "bg-slate-100 text-slate-500" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                          {pass.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{pass.visitorEmail}</p>
                      {pass.visitorCompany ? <p className="text-xs text-slate-400">{pass.visitorCompany}</p> : null}
                      {pass.identityCode ? (
                        <p className="mt-1 text-[10px] font-mono text-slate-400">Code: {pass.identityCode}</p>
                      ) : null}
                    </div>
                    {pass.status === "active" || pass.status === "completed" ? (
                      <span className="px-3 py-1 text-xs text-slate-400">{pass.status === "active" ? "In Premises" : "Exited"}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      ) : null}

      {/* ═══════════════ ENTRY LOGS ═══════════════ */}
      {activeSection === "entry-logs" ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Entry / Exit Logs</h3>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              {["", "entry", "exit"].map((t) => (
                <button
                  key={t}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    logType === t ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => { setLogType(t); setLogPage(1); }}
                  type="button"
                >
                  {t ? `${t.charAt(0).toUpperCase() + t.slice(1)}s` : "All"}{t && logCounts[t] ? ` (${logCounts[t]})` : ""}
                </button>
              ))}
            </div>
            <input type="date" value={logFrom} onChange={(e) => { setLogFrom(e.target.value); setLogPage(1); }}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              title="From date"
            />
            <input type="date" value={logTo} onChange={(e) => { setLogTo(e.target.value); setLogPage(1); }}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              title="To date"
            />
            <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" disabled={loadingLogs} onClick={loadEntryLogs}>
              {loadingLogs ? "Loading..." : "Refresh"}
            </ActionButton>
          </div>

          {loadingLogs ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading logs...</p>
          ) : entryLogs.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No logs found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                      <th className="px-3 py-2">Person</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 text-slate-700">
                        <td className="px-3 py-2.5">
                          {(log.user as any)?.name ? String((log.user as any).name) : "Visitor"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            log.type === "entry" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{log.method}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {(log.recordedBy as any)?.name ? String((log.recordedBy as any).name) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {logTotalPages > 1 ? (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={logPage <= 1} onClick={() => setLogPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </ActionButton>
                  <span className="text-xs text-slate-500">Page {logPage} of {logTotalPages}</span>
                  <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={logPage >= logTotalPages} onClick={() => setLogPage((p) => p + 1)}>
                    Next
                  </ActionButton>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* ═══════════════ LOST CARDS ═══════════════ */}
      {activeSection === "lost-cards" ? (
        <div>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Lost / Replacement Card Reports</h3>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: "", label: "All" },
              { key: "reported", label: "Reported" },
              { key: "under-verification", label: "Under Verification" },
              { key: "replacement-approved", label: "Approved" },
              { key: "card-disabled", label: "Access Disabled" },
              { key: "hr-approved", label: "HR Approved" },
              { key: "printing", label: "Printing" },
              { key: "ready-for-pickup", label: "Ready for Pickup" },
              { key: "completed", label: "Completed" },
              { key: "found", label: "Found" },
              { key: "rejected", label: "Rejected" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  lostCardFilter === key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setLostCardFilter(key)}
                type="button"
              >
                {label}{key ? (cardCounts[key] ? ` (${cardCounts[key]})` : " (0)") : ` (${lostCards.length})`}
              </button>
            ))}
          </div>

          {lostCards.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No reports found.</p>
          ) : (
            <div className="space-y-3">
              {lostCards.map((card) => {
                const isHr = role === "human-resource" || role === "admin";
                const isSecurity = role === "security" || role === "admin";
                const isAdmin = role === "admin";
                const userName = (card.user as any)?.name ?? "Unknown";
                const userEmail = (card.user as any)?.email ?? "";
                const userIdCode = (card.user as any)?.companyIdentityCode ?? "";

                const canAction = (status: string) => {
                  if (updatingCard === card.id) return true;
                  const map: Record<string, string[]> = {
                    "under-verification": ["admin", "human-resource", "security"],
                    rejected: ["admin", "human-resource", "security"],
                    "replacement-approved": ["admin", "human-resource", "security"],
                    "card-disabled": ["admin", "security"],
                    "hr-approved": ["admin", "human-resource"],
                    printing: ["admin"],
                    "ready-for-pickup": ["admin"],
                    completed: ["admin", "security"],
                  };
                  return (map[status] ?? []).includes(role);
                };

                return (
                  <div key={card.id} className={`rounded-xl border p-4 transition-all duration-300 ${highlightedCard === card.id ? "ring-2 ring-emerald-400 bg-emerald-50/50" : card.isEmergency ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-slate-50/50"}`}>
                    {/* Emergency badge */}
                    {card.isEmergency ? (
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">Emergency</span>
                      </div>
                    ) : null}

                    {/* Main row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Employee info */}
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{userName}</p>
                          {userIdCode ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">ID: {userIdCode}</span> : null}
                        </div>
                        <p className="text-xs text-slate-500">{userEmail}</p>

                        {/* Status + Reason + Priority */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {statusBadge(card.status)}
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 capitalize">{card.reason}</span>
                          {card.lastLocation ? <span className="text-[10px] text-slate-400">Location: {card.lastLocation}</span> : null}
                        </div>

                        {/* Assigned security + expected completion */}
                        {card.assignedSecurity ? (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Assigned: {String((card.assignedSecurity as any).name ?? "")}
                            {card.expectedCompletion ? ` · Expected: ${new Date(card.expectedCompletion).toLocaleString("en-IN")}` : ""}
                          </p>
                        ) : null}

                        {/* Notes */}
                        {card.notes ? <p className="mt-1 text-xs text-slate-400">Notes: {card.notes}</p> : null}

                        {/* Disabled zones */}
                        {card.disabledZones && card.disabledZones.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {card.disabledZones.map((z: string) => (
                              <span key={z} className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">{z}</span>
                            ))}
                          </div>
                        ) : null}

                        {/* New card info */}
                        {card.newCardNumber ? (
                          <p className="mt-1 text-[10px] font-mono text-slate-500">
                            New Card: {card.newCardNumber}{card.newRfidUid ? ` | RFID: ${card.newRfidUid}` : ""}
                            {card.expiryDate ? ` | Expires: ${new Date(card.expiryDate).toLocaleDateString("en-IN")}` : ""}
                          </p>
                        ) : null}

                        {/* Ticket / assignment info */}
                        {card.assignedSeniorSecurity ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                            <span>Senior Security: {String((card.assignedSeniorSecurity as any).name ?? "")}</span>
                            {card.assignedHR ? <span>· HR: {String((card.assignedHR as any).name ?? "")}</span> : null}
                            {card.seniorTicketOpened ? (
                              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${card.juniorCompletedAt ? "bg-emerald-100 text-emerald-700" : card.assignedJuniorSecurity ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                Ticket: {card.juniorCompletedAt ? "Completed" : card.assignedJuniorSecurity ? "In Progress" : "Awaiting Junior"}
                              </span>
                            ) : (
                              <span className="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">Ticket: Pending</span>
                            )}
                          </div>
                        ) : null}

                        {/* Follow-up notes */}
                        {card.followUpNotes && card.followUpNotes.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {card.followUpNotes.map((fn, i) => (
                              <p key={i} className="text-[10px] text-slate-500">
                                <span className="font-medium">{fn.addedByName}</span>: {fn.note}
                                {fn.addedAt ? ` · ${new Date(fn.addedAt).toLocaleString("en-IN")}` : ""}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        {/* Timeline toggle */}
                        {card.timeline && card.timeline.length > 0 ? (
                          <div className="mt-2">
                            <button
                              className="text-[10px] font-medium text-indigo-600 hover:underline"
                              onClick={() => setExpandedTimeline(expandedTimeline === card.id ? null : card.id)}
                              type="button"
                            >
                              {expandedTimeline === card.id ? "Hide Timeline" : "Show Timeline"}
                            </button>
                            {expandedTimeline === card.id ? (
                              <div className="mt-2 border-l-2 border-slate-200 pl-3">
                                {card.timeline.map((t, i) => (
                                  <div key={i} className="relative pb-2 last:pb-0">
                                    <div className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-indigo-400" />
                                    <p className="text-[10px] font-medium text-slate-700">{t.action || t.action}</p>
                                    <p className="text-[9px] text-slate-400">
                                      {t.actorName} · {new Date(t.timestamp).toLocaleString("en-IN")}
                                    </p>
                                    {t.notes ? <p className="text-[9px] text-slate-400">{t.notes}</p> : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Progress Stepper */}
                        <div className="mt-3">
                          <div className="flex items-center gap-1">
                            {REPLACEMENT_STEPS.map((step, i) => {
                              const isTerminal = ["rejected", "found", "found-after-replacement"].includes(card.status);
                              const currentIdx = isTerminal ? -1 : REPLACEMENT_STEPS.findIndex((s) => s.status === card.status);
                              const isDone = currentIdx >= 0 && i < currentIdx;
                              const isCurrent = currentIdx >= 0 && card.status === step.status;
                              return (
                                <div key={step.status} className="flex items-center">
                                  <div
                                    className={`h-2 w-2 rounded-full ${isDone ? "bg-emerald-500" : isCurrent ? "bg-indigo-500 ring-2 ring-indigo-200" : "bg-slate-200"}`}
                                    title={step.label}
                                  />
                                  {i < REPLACEMENT_STEPS.length - 1 ? (
                                    <div className={`h-0.5 w-3 ${isDone ? "bg-emerald-300" : "bg-slate-200"}`} />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-1.5 text-[10px] italic text-slate-400">
                            {nextActionHint(card)}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {/* Open Ticket (senior security — ticket not yet opened) */}
                        {card.status === "reported" && !card.seniorTicketOpened && (role === "admin" || role === "human-resource" || (role === "security" && isSenior)) ? (
                          <ActionButton variant="primary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => handleOpenTicket(card.id)}>
                            {updatingCard === card.id ? "..." : "Open Ticket"}
                          </ActionButton>
                        ) : null}

                        {/* Accept Ticket (junior security — ticket opened, not yet accepted) */}
                        {card.seniorTicketOpened && !card.assignedJuniorSecurity && role === "security" && !isSenior ? (
                          <ActionButton variant="approve" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => handleAcceptTicket(card.id)}>
                            {updatingCard === card.id ? "..." : "Accept Ticket"}
                          </ActionButton>
                        ) : null}

                        {/* Complete Ticket (assigned junior security — accepted, not yet completed) */}
                        {card.assignedJuniorSecurity && !card.juniorCompletedAt ? (
                          <ActionButton variant="primary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => { setCompleteTicketPopup({ id: card.id, show: true }); setCompleteTicketNote(""); }}>
                            {updatingCard === card.id ? "..." : "Complete with Follow-up"}
                          </ActionButton>
                        ) : null}

                        {/* reported → under-verification */}
                        {card.status === "reported" && canAction("under-verification") ? (
                          <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => setVerifyPopup({ id: card.id, show: true })}>
                            {updatingCard === card.id ? "..." : "Verify"}
                          </ActionButton>
                        ) : null}

                        {/* under-verification → replacement-approved */}
                        {card.status === "under-verification" && canAction("replacement-approved") ? (
                          <ActionButton variant="approve" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "replacement-approved")}>
                            {updatingCard === card.id ? "..." : "Approve Replacement"}
                          </ActionButton>
                        ) : null}

                        {/* replacement-approved → card-disabled */}
                        {card.status === "replacement-approved" && canAction("card-disabled") ? (
                          <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => setDisableAccessPopup({ id: card.id, show: true })}>
                            {updatingCard === card.id ? "..." : "Disable Access"}
                          </ActionButton>
                        ) : null}

                        {/* card-disabled → hr-approved */}
                        {card.status === "card-disabled" && canAction("hr-approved") ? (
                          <ActionButton variant="approve" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "hr-approved")}>
                            {updatingCard === card.id ? "..." : "HR Approve"}
                          </ActionButton>
                        ) : null}

                        {/* hr-approved → printing */}
                        {card.status === "hr-approved" && canAction("printing") ? (
                          <ActionButton variant="primary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => {
                            setPrintCardPopup({ id: card.id, show: true });
                            setPrintCardNumber("");
                            setPrintRfidUid("");
                            setPrintExpiryDate("");
                          }}>
                            {updatingCard === card.id ? "..." : "Print Card"}
                          </ActionButton>
                        ) : null}

                        {/* printing → ready-for-pickup */}
                        {card.status === "printing" && canAction("ready-for-pickup") ? (
                          <ActionButton variant="approve" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "ready-for-pickup")}>
                            {updatingCard === card.id ? "..." : "Ready for Pickup"}
                          </ActionButton>
                        ) : null}

                        {/* ready-for-pickup → completed */}
                        {card.status === "ready-for-pickup" && canAction("completed") ? (
                          <ActionButton variant="primary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "completed", { notes: "ID verified at collection" })}>
                            {updatingCard === card.id ? "..." : "Mark Collected"}
                          </ActionButton>
                        ) : null}

                        {/* Reject (reported / under-verification / card-disabled) */}
                        {(card.status === "reported" || card.status === "under-verification" || card.status === "card-disabled") && canAction("rejected") ? (
                          <ActionButton variant="danger" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => {
                            setRejectPopup({ id: card.id, show: true });
                            setRejectReason("");
                          }}>
                            {updatingCard === card.id ? "..." : "Reject"}
                          </ActionButton>
                        ) : null}

                        {/* Mark Found (reported / under-verification) */}
                        {(card.status === "reported" || card.status === "under-verification") && canAction("replacement-approved") ? (
                          <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => setFoundPopup({ id: card.id, show: true })}>
                            {updatingCard === card.id ? "..." : "Mark Found"}
                          </ActionButton>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Disable Access Popup */}
          {disableAccessPopup.show ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Disable Building Access</h3>
                <p className="mb-3 text-xs text-slate-500">Select zones to disable for the lost card:</p>
                {(["office-entry", "parking", "cafeteria", "printer", "server-room", "attendance-card"] as const).map((z) => (
                  <label key={z} className="flex items-center gap-2 py-1 text-xs text-slate-700">
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      data-zone={z}
                    />
                    {z.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </label>
                ))}
                <div className="mt-4 flex justify-end gap-2">
                  <ActionButton variant="secondary" onClick={() => setDisableAccessPopup({ id: "", show: false })}>Cancel</ActionButton>
                  <ActionButton variant="primary" onClick={() => {
                    const checked = document.querySelectorAll<HTMLInputElement>("[data-zone]:checked");
                    const zones = Array.from(checked).map((el) => el.dataset.zone ?? "");
                    handleDisableAccess(disableAccessPopup.id, zones);
                  }}>Disable</ActionButton>
                </div>
              </div>
            </div>
          ) : null}

          {/* Found Card Popup */}
          {foundPopup.show ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Card Found</h3>
                <p className="mb-3 text-xs text-slate-500">Was a replacement already issued for this card?</p>
                <div className="flex gap-2">
                  <ActionButton variant="secondary" onClick={() => handleFoundCard(foundPopup.id, true)} disabled={updatingCard === foundPopup.id}>
                    {updatingCard === foundPopup.id ? "..." : "Yes — Destroy Old Card"}
                  </ActionButton>
                  <ActionButton variant="primary" onClick={() => handleFoundCard(foundPopup.id, false)} disabled={updatingCard === foundPopup.id}>
                    {updatingCard === foundPopup.id ? "..." : "No — Reactivate"}
                  </ActionButton>
                </div>
                <div className="mt-3 text-center">
                  <button className="text-xs text-slate-500 hover:underline" onClick={() => setFoundPopup({ id: "", show: false })} type="button">Cancel</button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Complete Ticket Popup */}
          {completeTicketPopup.show ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Complete Ticket</h3>
                <p className="mb-3 text-xs text-slate-500">Add a follow-up note before completing this ticket:</p>
                <textarea className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  rows={3} value={completeTicketNote} onChange={(e) => setCompleteTicketNote(e.target.value)} placeholder="Describe what was done..."
                />
                <div className="mt-4 flex justify-end gap-2">
                  <ActionButton variant="secondary" onClick={() => setCompleteTicketPopup({ id: "", show: false })}>Cancel</ActionButton>
                  <ActionButton variant="primary" disabled={!completeTicketNote.trim() || updatingCard === completeTicketPopup.id} onClick={() => handleCompleteTicket(completeTicketPopup.id)}>
                    {updatingCard === completeTicketPopup.id ? "..." : "Complete Ticket"}
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : null}

          {/* Print Card Popup */}
          {printCardPopup.show ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Print New Card</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Card Number *</label>
                    <input className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={printCardNumber} onChange={(e) => setPrintCardNumber(e.target.value)} placeholder="e.g. CARD-2026-0042"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">RFID UID (optional)</label>
                    <input className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={printRfidUid} onChange={(e) => setPrintRfidUid(e.target.value)} placeholder="e.g. 04A3B2C1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Expiry Date (optional)</label>
                    <input type="date" className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={printExpiryDate} onChange={(e) => setPrintExpiryDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <ActionButton variant="secondary" onClick={() => setPrintCardPopup({ id: "", show: false })}>Cancel</ActionButton>
                  <ActionButton variant="primary" disabled={!printCardNumber.trim() || updatingCard === printCardPopup.id} onClick={() => {
                    updateCardStatus(printCardPopup.id, "printing", {
                      cardNumber: printCardNumber,
                      rfidUid: printRfidUid,
                      issueDate: new Date().toISOString(),
                      expiryDate: printExpiryDate || "",
                    });
                    setPrintCardPopup({ id: "", show: false });
                  }}>
                    {updatingCard === printCardPopup.id ? "..." : "Confirm Print"}
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : null}

          {/* Verify Popup */}
          {verifyPopup.show ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Verify Lost Card Report</h3>
                <p className="text-xs text-slate-500">
                  This marks the report as <span className="font-medium text-slate-700">Under Verification</span> and notifies HR that the investigation is in progress.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <ActionButton variant="secondary" onClick={() => setVerifyPopup({ id: "", show: false })}>Cancel</ActionButton>
                  <ActionButton variant="primary" disabled={updatingCard === verifyPopup.id} onClick={() => {
                    updateCardStatus(verifyPopup.id, "under-verification", { notes: "Verified by security" });
                    setVerifyPopup({ id: "", show: false });
                  }}>
                    {updatingCard === verifyPopup.id ? "..." : "Confirm Verify"}
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : null}

          {/* Reject Popup */}
          {rejectPopup.show ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Reject Report</h3>
                <p className="mb-3 text-xs text-slate-500">Provide a reason for rejection:</p>
                <textarea className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..."
                />
                <div className="mt-4 flex justify-end gap-2">
                  <ActionButton variant="secondary" onClick={() => setRejectPopup({ id: "", show: false })}>Cancel</ActionButton>
                  <ActionButton variant="danger" disabled={!rejectReason.trim() || updatingCard === rejectPopup.id} onClick={() => {
                    updateCardStatus(rejectPopup.id, "rejected", { notes: rejectReason });
                    setRejectPopup({ id: "", show: false });
                  }}>
                    {updatingCard === rejectPopup.id ? "..." : "Confirm Reject"}
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ═══════════════ EMERGENCY CONTACTS ═══════════════ */}
      {activeSection === "emergency" ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Emergency Contacts</h3>
          <p className="mb-4 text-xs text-slate-500">
            {isSenior ? "Showing all contact details including phone numbers." : "Showing emergency contacts. Phone numbers visible to senior security only."}
          </p>

          {loadingContacts ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading contacts...</p>
          ) : emergencyContacts.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No contacts available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Emergency Contact</th>
                    {isSenior ? <th className="px-3 py-2">Phone</th> : null}
                    <th className="px-3 py-2">Blood Group</th>
                    <th className="px-3 py-2">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {emergencyContacts.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 text-slate-700">
                      <td className="px-3 py-2.5 font-medium">{c.name}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{c.role}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{c.emergencyContact || "-"}</td>
                      {isSenior ? <td className="px-3 py-2.5 text-xs text-slate-500">{c.phone || "-"}</td> : null}
                      <td className="px-3 py-2.5 text-xs text-slate-500">{c.bloodGroup || "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{c.regionLabel || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
