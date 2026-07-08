"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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

type LostCardRecord = {
  id: string;
  user: AnyRecord | null;
  status: string;
  reportedAt: string;
  replacementRequestedAt: string | null;
  replacementIssuedAt: string | null;
  notes: string;
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
  const canIssuePass = role !== "employee" && (role !== "security" || isSenior);

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
  const [showIssuePass, setShowIssuePass] = useState(false);
  const [issueName, setIssueName] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [issuePhone, setIssuePhone] = useState("");
  const [issueCompany, setIssueCompany] = useState(String(company?.name ?? ""));
  const [issueRegion, setIssueRegion] = useState("");
  const [issuePurpose, setIssuePurpose] = useState("");
  const [issueTimeIn, setIssueTimeIn] = useState("");
  const [issueTimeOut, setIssueTimeOut] = useState("");
  const [issuing, setIssuing] = useState(false);

  // ── Entry Logs ──
  const [entryLogs, setEntryLogs] = useState<EntryLogRecord[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logType, setLogType] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ── Lost Cards ──
  const [lostCards, setLostCards] = useState<LostCardRecord[]>([]);
  const [lostCardFilter, setLostCardFilter] = useState("");
  const [showReportLost, setShowReportLost] = useState(false);
  const [reportUserId, setReportUserId] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reporting, setReporting] = useState(false);
  const [updatingCard, setUpdatingCard] = useState<string | null>(null);

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
      if (res.type === "not-found") showToast("No match found for this code.", "error");
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

  async function logEntry(type: "entry" | "exit") {
    if (!scanResult?.data) return;
    setLoggingEntry(true);
    try {
      await apiFetch("/api/hr/security/entry-logs", {
        method: "POST",
        body: JSON.stringify({
          code: scanCode.trim().toUpperCase(),
          type,
        }),
      });
      showToast(`${type === "entry" ? "Entry" : "Exit"} logged.`);
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

  async function handleIssuePass(e: React.FormEvent) {
    e.preventDefault();
    if (!issueName || !issueEmail) return;
    setIssuing(true);
    try {
      await apiFetch("/api/hr/visitor/passes", {
        method: "POST",
        body: JSON.stringify({
          visitorName: issueName,
          visitorEmail: issueEmail,
          visitorPhone: issuePhone,
          visitorCompany: issueCompany,
          region: issueRegion,
          purpose: issuePurpose,
          timeIn: issueTimeIn ? new Date(issueTimeIn).toISOString() : null,
          timeOut: issueTimeOut ? new Date(issueTimeOut).toISOString() : null,
        }),
      });
      showToast("Visitor pass issued.");
      setShowIssuePass(false);
      setIssueName("");
      setIssueEmail("");
      setIssuePhone("");
      setIssueCompany(String(company?.name ?? ""));
      setIssueRegion("");
      setIssuePurpose("");
      setIssueTimeIn("");
      setIssueTimeOut("");
      await loadPasses();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to issue pass.", "error");
    } finally {
      setIssuing(false);
    }
  }

  // ── Entry Logs ──
  async function loadEntryLogs() {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({ page: String(logPage), limit: "10" });
      if (logType) params.set("type", logType);
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

  async function handleReportLost(e: React.FormEvent) {
    e.preventDefault();
    if (!reportUserId) return;
    setReporting(true);
    try {
      await apiFetch("/api/hr/security/lost-cards", {
        method: "POST",
        body: JSON.stringify({ userId: reportUserId, notes: reportNotes }),
      });
      showToast("Lost card reported.");
      setShowReportLost(false);
      setReportUserId("");
      setReportNotes("");
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to report.", "error");
    } finally {
      setReporting(false);
    }
  }

  async function updateCardStatus(id: string, status: string) {
    setUpdatingCard(id);
    try {
      await apiFetch(`/api/hr/security/lost-cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast(`Status updated to "${status}".`);
      await loadLostCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "error");
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

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      reported: "bg-amber-100 text-amber-700",
      "replacement-requested": "bg-blue-100 text-blue-700",
      replaced: "bg-emerald-100 text-emerald-700",
      found: "bg-slate-100 text-slate-700",
    };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[status] ?? "bg-slate-100 text-slate-500"}`}>{status}</span>;
  };

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
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
      <SectionHeader title="Security Dashboard" description="Verify identities, manage visitors, and monitor premises." accent="indigo" />
      {sectionNav}

      {/* ═══════════════ VERIFY EMPLOYEE ═══════════════ */}
      {activeSection === "verify" ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Verify Employee ID</h3>
          <div className="mb-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
                        <p className="mt-1 text-xs text-slate-400">Host: {String(scanResult.data.hostName ?? "N/A")}</p>
                      </div>
                      {String(scanResult.data.status) === "approved" ? (
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
                    <ActionButton variant="secondary" onClick={() => { setScanResult(null); setShowManualEntry(false); setCameraUnavailable(false); }}>
                      Scan Another
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-slate-500">No match found for this code.</p>
                  <ActionButton variant="secondary" onClick={() => { setScanResult(null); setShowManualEntry(false); setCameraUnavailable(false); }}>
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Today&apos;s Visitors</h3>
            {canIssuePass ? (
              <ActionButton variant="primary" onClick={() => setShowIssuePass(true)}>
                + Issue Pass
              </ActionButton>
            ) : null}
          </div>

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
                {f.charAt(0).toUpperCase() + f.slice(1)}
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

          {/* Issue Pass Modal */}
          {showIssuePass ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Issue Visitor Pass</h3>
                <form onSubmit={handleIssuePass} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Visitor Name *</label>
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={issueName} onChange={(e) => setIssueName(e.target.value)} required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
                    <input type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={issueEmail} onChange={(e) => setIssueEmail(e.target.value)} required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={issuePhone} onChange={(e) => setIssuePhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Company</label>
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {issueCompany || "—"}
                    </p>
                  </div>
                  {(() => {
                    const multiOffice = company?.multiOffice ? Boolean(company.multiOffice) : false;
                    const regionOpts = multiOffice && Array.isArray(company?.addresses)
                      ? (company.addresses as AnyRecord[]).map((a: AnyRecord) => String(a.label ?? "")).filter(Boolean)
                      : company?.address
                        ? ["Main Office"]
                        : [];
                    return regionOpts.length > 0 ? (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Region</label>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          value={issueRegion} onChange={(e) => setIssueRegion(e.target.value)}
                        >
                          <option value="">Select region...</option>
                          {regionOpts.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    ) : null;
                  })()}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Purpose</label>
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={issuePurpose} onChange={(e) => setIssuePurpose(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Time In (±30 min)</label>
                    <input type="datetime-local"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={issueTimeIn}
                      onChange={(e) => setIssueTimeIn(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Time Out (±30 min)</label>
                    <input type="datetime-local"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={issueTimeOut}
                      onChange={(e) => setIssueTimeOut(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <ActionButton variant="secondary" type="button" onClick={() => setShowIssuePass(false)}>Cancel</ActionButton>
                    <ActionButton variant="primary" type="submit" disabled={issuing}>
                      {issuing ? "Issuing..." : "Issue Pass"}
                    </ActionButton>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

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
                  {t ? `${t.charAt(0).toUpperCase() + t.slice(1)}s` : "All"}
                </button>
              ))}
            </div>
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Lost / Replacement Card Reports</h3>
            <ActionButton variant="primary" onClick={() => setShowReportLost(true)}>
              + Report Lost Card
            </ActionButton>
          </div>

          <div className="mb-4 flex gap-2">
            {["", "reported", "replacement-requested", "replaced", "found"].map((f) => (
              <button
                key={f}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  lostCardFilter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setLostCardFilter(f)}
                type="button"
              >
                {f ? f.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "All"}
              </button>
            ))}
          </div>

          {lostCards.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No reports found.</p>
          ) : (
            <div className="space-y-3">
              {lostCards.map((card) => (
                <div key={card.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {(card.user as any)?.name ? String((card.user as any).name) : "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">{(card.user as any)?.email ? String((card.user as any).email) : ""}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {statusBadge(card.status)}
                        <span className="text-[10px] text-slate-400">
                          Reported: {new Date(card.reportedAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      {card.notes ? <p className="mt-1 text-xs text-slate-400">Notes: {card.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {card.status === "reported" ? (
                        <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "replacement-requested")}>
                          {updatingCard === card.id ? "..." : "Request Replacement"}
                        </ActionButton>
                      ) : null}
                      {card.status === "replacement-requested" ? (
                        <ActionButton variant="approve" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "replaced")}>
                          {updatingCard === card.id ? "..." : "Mark Replaced"}
                        </ActionButton>
                      ) : null}
                      {card.status === "reported" || card.status === "replacement-requested" ? (
                        <ActionButton variant="secondary" className="px-3 py-1 text-xs" disabled={updatingCard === card.id} onClick={() => updateCardStatus(card.id, "found")}>
                          {updatingCard === card.id ? "..." : "Mark Found"}
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Report Lost Card Modal */}
          {showReportLost ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Report Lost / Request Replacement</h3>
                <form onSubmit={handleReportLost} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Employee ID *</label>
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      value={reportUserId} onChange={(e) => setReportUserId(e.target.value)} placeholder="Enter user ID" required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                    <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      rows={3} value={reportNotes} onChange={(e) => setReportNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <ActionButton variant="secondary" type="button" onClick={() => setShowReportLost(false)}>Cancel</ActionButton>
                    <ActionButton variant="primary" type="submit" disabled={reporting}>
                      {reporting ? "Submitting..." : "Submit Report"}
                    </ActionButton>
                  </div>
                </form>
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
