import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord, formatRole, SectionHeader } from "../shared";

export function MessagesTab({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"normal" | "bulk">("normal");
  const [chatMember, setChatMember] = useState<AnyRecord | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [sendingBulk, setSendingBulk] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchInput, setMessageSearchInput] = useState("");

  useEffect(() => {
    let mounted = true;
    apiFetch<{ members: AnyRecord[] }>("/api/messages")
      .then((result) => { if (mounted) setMembers(result.members ?? []); })
      .catch(() => { if (mounted) setMembers([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setChatMember(null);
    }
    if (!chatMember) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatMember]);

  const membersById = useMemo(() => {
    const map = new Map<string, AnyRecord>();
    members.forEach((m) => { const id = String(m.id ?? m._id ?? ""); if (id) map.set(id, m); });
    return map;
  }, [members]);

  const bulkSelectedIds = useMemo(() => {
    return Object.keys(bulkSelected).filter((id) => bulkSelected[id] && membersById.has(id));
  }, [bulkSelected, membersById]);

  function toggleBulkSelected(memberId: string) {
    setBulkSelected((current) => ({ ...current, [memberId]: !current[memberId] }));
  }

  async function sendChat() {
    const recipientId = String(chatMember?.id ?? chatMember?._id ?? "");
    const message = String(chatMessage ?? "").trim();
    if (!recipientId) return;
    if (!message) { showToast("Write a message first.", "error"); return; }
    try {
      setSendingChat(true);
      await apiFetch("/api/messages", { method: "POST", body: JSON.stringify({ recipientId, message }) });
      setChatMessage(""); setChatMember(null); showToast("Message sent.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send message.", "error");
    } finally { setSendingChat(false); }
  }

  async function sendBulk() {
    const message = String(bulkMessage ?? "").trim();
    if (!message) { showToast("Write a message first.", "error"); return; }
    if (bulkSelectedIds.length === 0) { showToast("Select at least one user.", "error"); return; }
    try {
      setSendingBulk(true);
      await Promise.all(bulkSelectedIds.map((recipientId) => apiFetch("/api/messages", { method: "POST", body: JSON.stringify({ recipientId, message }) })));
      setBulkMessage(""); setBulkSelected({}); showToast(`Message sent to ${bulkSelectedIds.length} user(s).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send bulk message.", "error");
    } finally { setSendingBulk(false); }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Messages" description="Send messages to your team or the entire company." accent="sky" />
      <div className="mb-4">
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-100">{members.length} members</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "normal" ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`} type="button" onClick={() => setMode("normal")}>Normal messages</button>
          <button className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "bulk" ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`} type="button" onClick={() => setMode("bulk")}>Bulk messages</button>
        </div>
        {mode === "bulk" ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-50 px-3 py-2">Selected: <span className="font-semibold text-slate-900">{bulkSelectedIds.length}</span></span>
            <ActionButton variant="secondary" className="px-3" disabled={bulkSelectedIds.length === 0} type="button" onClick={() => setBulkSelected({})}>Clear</ActionButton>
          </div>
        ) : null}
      </div>

      {mode === "bulk" ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Bulk message</p>
          <p className="mt-1 text-sm text-slate-500">Write one message, then click users below to send.</p>
          <textarea className="mt-3 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Type your bulk message…" value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Tip: click user cards to select/unselect.</p>
            <ActionButton variant="primary" disabled={sendingBulk || bulkSelectedIds.length === 0 || String(bulkMessage ?? "").trim().length === 0} type="button" onClick={() => void sendBulk()}>
              {sendingBulk ? "Sending…" : "Send to selected"}
            </ActionButton>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex gap-2">
        <input value={messageSearchInput} onChange={(e) => setMessageSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setMessageSearchQuery(messageSearchInput.trim()); }}
          placeholder="Search members by name, email, or role..." className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-0" />
        <button onClick={() => setMessageSearchQuery(messageSearchInput.trim())} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Search</button>
      </div>

      <div className="mt-4 space-y-3">
        {(() => {
          const query = messageSearchQuery.toLowerCase().trim();
          const filtered = query ? members.filter((m) => {
            const name = String(m.name ?? "").toLowerCase();
            const email = String(m.email ?? "").toLowerCase();
            const role = String(m.role ?? "").toLowerCase();
            return name.includes(query) || email.includes(query) || role.includes(query);
          }) : members;
          if (filtered.length === 0) {
            return <p className="py-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">No members match your search.</p>;
          }
          return filtered.map((member) => {
            const memberId = String(member.id ?? member._id ?? "");
            const name = String(member.name ?? "Member");
            const roleRaw = String(member.role ?? "employee");
            const role = formatRole(roleRaw);
            const email = String(member.email ?? "");
            const isHighProfile = ["admin", "human-resource", "finance"].includes(roleRaw);
            const joinDateStr = member.companyJoined ? new Date(String(member.companyJoined)).toLocaleDateString() : member.createdAt ? new Date(String(member.createdAt)).toLocaleDateString() : null;
            let label: string;
            if (isHighProfile) {
              const companyName = member.company && typeof member.company === "object" ? String((member.company as AnyRecord).name ?? "") : "";
              label = companyName || "No company";
            } else {
              const teamObj = member.team && typeof member.team === "object" ? member.team : null;
              label = teamObj && (teamObj as AnyRecord).name ? String((teamObj as AnyRecord).name) : Array.isArray(member.teams) && member.teams.length ? member.teams.map(String).join(", ") : "No team joined";
            }
            const isSelected = !!bulkSelected[memberId];

            return (
              <button className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${mode === "bulk" ? isSelected ? "border-slate-900 bg-slate-950 text-white shadow-md" : "border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300" : "border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300"}`}
                key={memberId} type="button"
                onClick={() => { if (mode === "bulk") { toggleBulkSelected(memberId); } else { setChatMember(member); setChatMessage(""); } }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-semibold ${mode === "bulk" && isSelected ? "text-white" : "text-slate-900"}`}>{name}</p>
                    <p className={`text-sm ${mode === "bulk" && isSelected ? "text-white/70" : "text-slate-500"}`}>{email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${mode === "bulk" && isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"}`}>{role}</span>
                    <span className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${mode === "bulk" && isSelected ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-700"}`} title={isHighProfile ? label : `Team: ${label}`}>
                      {isHighProfile ? `Company: ${label}` : `Team: ${label}`}{joinDateStr ? ` · ${joinDateStr}` : ""}
                    </span>
                    {mode === "normal" ? (
                      <span className="inline-flex items-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Chat</span>
                    ) : (
                      <span className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold ${isSelected ? "bg-white text-slate-950" : "bg-slate-950 text-white"}`}>{isSelected ? "Selected" : "Select"}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          });
        })()}

        {!loading && messageSearchQuery === "" && members.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No other approved company members yet.</p>
        ) : null}
        {loading ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Loading company members...</p>
        ) : null}
      </div>

      {chatMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setChatMember(null); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="chat-modal-title">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-lg font-semibold" id="chat-modal-title">Chat</h4>
                <p className="text-sm text-slate-500">To <span className="font-medium text-slate-900">{String(chatMember.name ?? "Member")}</span> • {formatRole(String(chatMember.role ?? "employee"))}</p>
              </div>
              <ActionButton aria-label="Close" variant="ghost" className="h-9 w-9" type="button" onClick={() => setChatMember(null)}><X size={18} /></ActionButton>
            </div>
            <div className="px-5 py-4">
              <textarea className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Type your message…" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} />
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <ActionButton variant="secondary" type="button" onClick={() => setChatMember(null)}>Cancel</ActionButton>
                <ActionButton variant="primary" disabled={sendingChat || String(chatMessage ?? "").trim().length === 0} type="button" onClick={() => void sendChat()}>
                  {sendingChat ? "Sending…" : "Send"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
