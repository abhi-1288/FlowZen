"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton } from "./shared";

type User = { _id: string; name: string; email?: string; regionLabel?: string };

export function TerminationLetterModal({ onClose, onSuccess, showToast }: {
  onClose: () => void;
  onSuccess: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [members, setMembers] = useState<User[]>([]);
  const [hrs, setHrs] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [memberId, setMemberId] = useState("");
  const [hrId, setHrId] = useState("");
  const [adminId, setAdminId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiFetch<{ users: User[] }>("/api/users?role=employee,project-manager,qa-tester,finance,human-resource,it-admin,security").then((r) => setMembers(r.users ?? [])).catch(() => {});
    void apiFetch<{ users: User[] }>("/api/users?role=human-resource&region=mine").then((r) => setHrs(r.users ?? [])).catch(() => {});
    void apiFetch<{ users: User[] }>("/api/users?role=admin&region=mine").then((r) => setAdmins(r.users ?? [])).catch(() => {});
  }, []);

  async function submit() {
    if (!memberId || !hrId || !adminId || !reason.trim()) {
      showToast("Select member, HR, admin and provide a reason.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/hr/termination-letter/request", {
        method: "POST",
        body: JSON.stringify({ memberId, hrId, adminId, reason: reason.trim() }),
      });
      showToast("Termination letter request created.");
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create request.", "error");
    } finally {
      setSaving(false);
    }
  }

  const select = "neu-inset w-full rounded-md px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl neu-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Create termination letter</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Requester, target member, HR and admin must be in the same region.</p>
        <div className="mt-4 space-y-3">
          <select className={select} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Select target member</option>
            {members.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <select className={select} value={hrId} onChange={(e) => setHrId(e.target.value)}>
            <option value="">Select region HR for e-sign</option>
            {hrs.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <select className={select} value={adminId} onChange={(e) => setAdminId(e.target.value)}>
            <option value="">Select region admin for e-sign</option>
            {admins.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <textarea className={select} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onClose}>Cancel</ActionButton>
          <ActionButton disabled={saving} onClick={() => void submit()}>{saving ? "Creating..." : "Create request"}</ActionButton>
        </div>
      </div>
    </div>
  );
}
