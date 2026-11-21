"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSeniorSecurity?: boolean;
  customRole?: string;
  regionLabel?: string;
  companyIdentityCode?: string;
};

const ROLE_LABEL: Record<string, string> = {
  "human-resource": "Human Resource",
  "project-manager": "Project Manager",
  "qa-tester": "Q-A Tester",
  finance: "Finance",
  admin: "Admin",
  "it-admin": "IT Admin",
  "it-administration": "IT Administration",
  employee: "Employee",
  others: "Others",
  security: "Security",
};

function tileKey(m: Member): string {
  if (m.role === "security") return m.isSeniorSecurity ? "security-senior" : "security-junior";
  return m.role;
}

function tileLabel(key: string): string {
  if (key === "security-senior") return "Senior Security";
  if (key === "security-junior") return "Junior Security";
  if (key === "all") return "All members";
  return ROLE_LABEL[key] || key;
}

export function AuditReportTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; members: Member[] }[]>([]);
  const [region, setRegion] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Resolve the signed-in user's own region first so we only show
        // members from that region (never other regions / "All offices").
        let ownRegion = "";
        try {
          const profRes = await fetch("/api/profile");
          if (profRes.ok) {
            const prof = await profRes.json();
            ownRegion = String(prof?.user?.regionLabel || prof?.regionLabel || prof?.region || "");
          }
        } catch {
          // ignore
        }
        const url = ownRegion
          ? `/api/hr/members?region=${encodeURIComponent(ownRegion)}`
          : "/api/hr/members";
        // Fetch regional members (may be 403 for non-HR) and the user's own
        // team members (if they manage any team) in parallel.
        const [regionRes, teamRes] = await Promise.all([
          fetch(url),
          fetch("/api/profile/audit/team-members"),
        ]);
        if (regionRes.ok) {
          const data = await regionRes.json();
          setRegion(String(data.region || data.regionLabel || ownRegion || ""));
          setRegionLabel(String(data.regionLabel || data.region || ownRegion || ""));
          setMembers(
            (data.members || []).map((m: any) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              role: m.role,
              isSeniorSecurity: Boolean(m.isSeniorSecurity),
              customRole: m.customRole,
              regionLabel: m.regionLabel,
              companyIdentityCode: m.companyIdentityCode,
            })),
          );
        }
        if (teamRes.ok) {
          const tdata = await teamRes.json();
          setTeams(
            (tdata.teams || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              members: (t.members || []).map((m: any) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                role: m.role,
                isSeniorSecurity: Boolean(m.isSeniorSecurity),
                customRole: m.customRole,
                regionLabel: m.regionLabel,
                companyIdentityCode: m.companyIdentityCode,
              })),
            })),
          );
          setTeamMembers(
            (tdata.members || []).map((m: any) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              role: m.role,
              isSeniorSecurity: Boolean(m.isSeniorSecurity),
              customRole: m.customRole,
              regionLabel: m.regionLabel,
              companyIdentityCode: m.companyIdentityCode,
            })),
          );
        }
        if (!regionRes.ok && !teamRes.ok) throw new Error("Failed to load members");
      } catch (e: any) {
        setError(e?.message || "Failed to load members");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tiles = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of members) {
      const k = tileKey(m);
      counts[k] = (counts[k] || 0) + 1;
    }
    const keys = Object.keys(counts).sort();
    const out = keys.map((k) => ({ key: k, label: tileLabel(k), count: counts[k] }));
    out.push({ key: "my-team", label: "My Team", count: teamMembers.length });
    return out;
  }, [members, teamMembers]);

  const modalMembers = useMemo(() => {
    if (!activeTile) return [];
    let list: Member[] = [];
    if (activeTile === "my-team") list = teamMembers;
    else list = members.filter((m) => tileKey(m) === activeTile);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.companyIdentityCode || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [members, activeTile, search]);

  const download = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({ userId: selected.id });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/profile/audit/report?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to fetch report data");
      }
      const data = await res.json();

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let y = 12;

      const line = (text: string, size = 10, bold = false) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, 186);
        doc.text(lines, 12, y);
        y += lines.length * (size * 0.45 + 1);
      };

      line(data.company?.name || "Company", 16, true);
      if (data.company?.address) line(`Address: ${data.company.address}`, 9);
      if (data.company?.region) line(`Region: ${data.company.region}`, 9);
      if (data.company?.contact) line(`Contact: ${data.company.contact}`, 9);
      line(`Audit date: ${new Date(data.auditDate).toLocaleString()}`, 9);
      y += 2;
      line("Audited person profile", 12, true);
      const a = data.audited;
      line(`Name: ${a.name}`, 9);
      line(`Email: ${a.email}`, 9);
      line(`Phone: ${a.phone}`, 9);
      line(`Emergency: ${a.emergencyContact}`, 9);
      line(`Employment type: ${a.employmentType}`, 9);
      line(`Unique identity: ${a.uniqueIdentity}`, 9);
      if (a.exitDate) line(`Exit date: ${new Date(a.exitDate).toLocaleDateString()}`, 9);
      line(`Region: ${a.region}`, 9);
      y += 2;
      line("Auditor profile", 12, true);
      const u = data.auditor;
      line(`Name: ${u.name}`, 9);
      line(`Email: ${u.email}`, 9);
      line(`Phone: ${u.phone}`, 9);
      line(`Emergency: ${u.emergencyContact}`, 9);
      line(`Employment type: ${u.employmentType}`, 9);
      line(`Unique identity: ${u.uniqueIdentity}`, 9);
      if (u.exitDate) line(`Exit date: ${new Date(u.exitDate).toLocaleDateString()}`, 9);
      line(`Region: ${u.region}`, 9);
      y += 2;

      line(`Audit events (${data.total})`, 12, true);
      line(`Period: ${data.from || "—"} to ${data.to || "—"}`, 9);
      y += 1;

      const events = data.items || [];
      const counts: Record<string, number> = {};
      let success = 0;
      let failed = 0;
      for (const ev of events) {
        const action = String(ev.action || "");
        const prefix = action.split(".")[0] + ".";
        counts[prefix] = (counts[prefix] || 0) + 1;
        if (ev.result === "failed") failed++;
        else success++;
        if (y > 270) {
          doc.addPage();
          y = 12;
        }
        line(`${new Date(ev.createdAt).toLocaleString()} — ${ev.actionLabel || ev.action} [${ev.result || "success"}]`, 9, true);
        if (ev.actorName || ev.actorEmail) line(`Actor: ${ev.actorName} ${ev.actorEmail ? "(" + ev.actorEmail + ")" : ""} ${ev.actorRole ? "- " + ev.actorRole : ""}`, 8);
        if (ev.targetName || ev.targetEmail) line(`Target: ${ev.targetName} ${ev.targetEmail ? "(" + ev.targetEmail + ")" : ""}`, 8);
        if (ev.entityType || ev.entityId) line(`Entity: ${ev.entityType} ${ev.entityId}`, 8);
        if (ev.ip) line(`IP: ${ev.ip}  Device: ${ev.device}`, 8);
        if (ev.from || ev.to) line(`Change: ${JSON.stringify(ev.from ?? "")} -> ${JSON.stringify(ev.to ?? "")}`, 8);
        y += 1;
      }

      if (y > 250) {
        doc.addPage();
        y = 12;
      }
      y += 2;
      line("Summary", 12, true);
      line(`Total events: ${events.length}`, 9);
      line(`Successful: ${success}`, 9);
      line(`Failed: ${failed}`, 9);
      for (const [k, v] of Object.entries(counts)) {
        line(`${k}: ${v}`, 9);
      }

      doc.save(`audit-report-${selected.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      alert(e?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading members…</div>;
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Company Members</h2>
          <p className="text-sm text-gray-500">Select a member to download their audit report.</p>
          {(region || regionLabel) && (
            <p className="text-xs text-blue-600 mt-1">
              Showing members of region: <span className="font-semibold">{regionLabel || region}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTile(t.key)}
            className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 hover:border-blue-400"
          >
            <div className="text-2xl font-bold">{t.count}</div>
            <div className="text-sm font-medium mt-1">{t.label}</div>
            <div className="text-xs text-blue-600 mt-2">View &amp; download</div>
          </button>
        ))}
      </div>

      {activeTile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setActiveTile(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{tileLabel(activeTile)}</h3>
              <button onClick={() => setActiveTile(null)}><X size={18} /></button>
            </div>
            <input
              className="w-full border rounded px-2 py-1 mb-3"
              placeholder="Search by name, email or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-2">
              {activeTile === "my-team" && (
                <div className="text-xs text-gray-500 mb-2">
                  {teams.length} team{teams.length === 1 ? "" : "s"} you manage
                </div>
              )}
              {activeTile === "my-team"
                ? teams.map((t) => (
                    <div key={t.id} className="border rounded-lg p-3 mb-2">
                      <div className="font-semibold text-sm mb-2">
                        {t.name} <span className="text-gray-400">({t.members.length})</span>
                      </div>
                      <div className="space-y-2">
                        {t.members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{m.name}</div>
                              <div className="text-xs text-gray-500">{m.email} · {m.role}</div>
                            </div>
                            <button
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
                              onClick={() => setSelected(m)}
                            >
                              <Download size={14} /> Download
                            </button>
                          </div>
                        ))}
                        {t.members.length === 0 && <div className="text-xs text-gray-500">No members.</div>}
                      </div>
                    </div>
                  ))
                : null}
              {activeTile === "my-team" && teams.length === 0 && (
                <div className="text-sm text-gray-500">No team found.</div>
              )}
              {activeTile !== "my-team" && modalMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.email} · {m.role}</div>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
                    onClick={() => setSelected(m)}
                  >
                    <Download size={14} /> Download
                  </button>
                </div>
              ))}
              {modalMembers.length === 0 && <div className="text-sm text-gray-500">No members found.</div>}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Audit report for {selected.name}</h3>
              <button onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">From</label>
                <input type="date" className="w-full border rounded px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500">To</label>
                <input type="date" className="w-full border rounded px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <button
                className="w-full py-2 rounded bg-blue-600 text-white font-medium disabled:opacity-50"
                onClick={download}
                disabled={downloading}
              >
                {downloading ? "Generating…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}