import { Camera, ChevronDown, Info, Mail, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";
import { AvatarBadge, Row, SectionHeader } from "../shared";

const COUNTRY_CODES = [
  { code: "+1", label: "+1", flag: "\uD83C\uDDFA\uD83C\uDDF8", country: "US" },
  { code: "+44", label: "+44", flag: "\uD83C\uDDEC\uD83C\uDDE7", country: "UK" },
  { code: "+91", label: "+91", flag: "\uD83C\uDDEE\uD83C\uDDF3", country: "IN" },
  { code: "+61", label: "+61", flag: "\uD83C\uDDE6\uD83C\uDDFA", country: "AU" },
  { code: "+81", label: "+81", flag: "\uD83C\uDDEF\uD83C\uDDF5", country: "JP" },
  { code: "+86", label: "+86", flag: "\uD83C\uDDE8\uD83C\uDDF3", country: "CN" },
  { code: "+49", label: "+49", flag: "\uD83C\uDDE9\uD83C\uDDEA", country: "DE" },
  { code: "+33", label: "+33", flag: "\uD83C\uDDEB\uD83C\uDDF7", country: "FR" },
  { code: "+971", label: "+971", flag: "\uD83C\uDDE6\uD83C\uDDEA", country: "AE" },
  { code: "+65", label: "+65", flag: "\uD83C\uDDF8\uD83C\uDDEC", country: "SG" },
  { code: "+852", label: "+852", flag: "\uD83C\uDDED\uD83C\uDDF0", country: "HK" },
  { code: "+82", label: "+82", flag: "\uD83C\uDDF0\uD83C\uDDF7", country: "KR" },
  { code: "+55", label: "+55", flag: "\uD83C\uDDE7\uD83C\uDDF7", country: "BR" },
  { code: "+7", label: "+7", flag: "\uD83C\uDDF7\uD83C\uDDFA", country: "RU" },
  { code: "+39", label: "+39", flag: "\uD83C\uDDEE\uD83C\uDDF9", country: "IT" },
  { code: "+34", label: "+34", flag: "\uD83C\uDDEA\uD83C\uDDF8", country: "ES" },

  { code: "+52", label: "+52", flag: "\uD83C\uDDF2\uD83C\uDDFD", country: "MX" },
  { code: "+31", label: "+31", flag: "\uD83C\uDDF3\uD83C\uDDF1", country: "NL" },
  { code: "+46", label: "+46", flag: "\uD83C\uDDF8\uD83C\uDDEA", country: "SE" },
  { code: "+41", label: "+41", flag: "\uD83C\uDDE8\uD83C\uDDED", country: "CH" },
  { code: "+47", label: "+47", flag: "\uD83C\uDDF3\uD83C\uDDF4", country: "NO" },
  { code: "+45", label: "+45", flag: "\uD83C\uDDE9\uD83C\uDDF0", country: "DK" },
  { code: "+358", label: "+358", flag: "\uD83C\uDDEB\uD83C\uDDEE", country: "FI" },
  { code: "+60", label: "+60", flag: "\uD83C\uDDF2\uD83C\uDDFE", country: "MY" },
  { code: "+63", label: "+63", flag: "\uD83C\uDDF5\uD83C\uDDED", country: "PH" },
  { code: "+62", label: "+62", flag: "\uD83C\uDDEE\uD83C\uDDE9", country: "ID" },
  { code: "+64", label: "+64", flag: "\uD83C\uDDF3\uD83C\uDDFF", country: "NZ" },
  { code: "+27", label: "+27", flag: "\uD83C\uDDFF\uD83C\uDDE6", country: "ZA" },
  { code: "+966", label: "+966", flag: "\uD83C\uDDF8\uD83C\uDDE6", country: "SA" },
  { code: "+20", label: "+20", flag: "\uD83C\uDDEA\uD83C\uDDEC", country: "EG" },
  { code: "+92", label: "+92", flag: "\uD83C\uDDF5\uD83C\uDDF0", country: "PK" },
  { code: "+880", label: "+880", flag: "\uD83C\uDDE7\uD83C\uDDE9", country: "BD" },
  { code: "+84", label: "+84", flag: "\uD83C\uDDFB\uD83C\uDDF3", country: "VN" },
  { code: "+66", label: "+66", flag: "\uD83C\uDDF9\uD83C\uDDED", country: "TH" },
  { code: "+90", label: "+90", flag: "\uD83C\uDDF9\uD83C\uDDF7", country: "TR" },
  { code: "+48", label: "+48", flag: "\uD83C\uDDF5\uD83C\uDDF1", country: "PL" },
  { code: "+30", label: "+30", flag: "\uD83C\uDDEC\uD83C\uDDF7", country: "GR" },
  { code: "+351", label: "+351", flag: "\uD83C\uDDF5\uD83C\uDDF9", country: "PT" },
  { code: "+353", label: "+353", flag: "\uD83C\uDDEE\uD83C\uDDEA", country: "IE" },
  { code: "+56", label: "+56", flag: "\uD83C\uDDE8\uD83C\uDDF1", country: "CL" },
  { code: "+54", label: "+54", flag: "\uD83C\uDDE6\uD83C\uDDF7", country: "AR" },
  { code: "+57", label: "+57", flag: "\uD83C\uDDE8\uD83C\uDDF4", country: "CO" },
  { code: "+98", label: "+98", flag: "\uD83C\uDDEE\uD83C\uDDF7", country: "IR" },
  { code: "+972", label: "+972", flag: "\uD83C\uDDEE\uD83C\uDDF1", country: "IL" },
  { code: "+234", label: "+234", flag: "\uD83C\uDDF3\uD83C\uDDEC", country: "NG" },
  { code: "+254", label: "+254", flag: "\uD83C\uDDF0\uD83C\uDDEA", country: "KE" },
  { code: "+233", label: "+233", flag: "\uD83C\uDDEC\uD83C\uDDED", country: "GH" },
  { code: "+94", label: "+94", flag: "\uD83C\uDDF1\uD83C\uDDF0", country: "LK" },
  { code: "+977", label: "+977", flag: "\uD83C\uDDF3\uD83C\uDDF1", country: "NP" },
];

function detectCountryCode(phone: string): string {
  const cleaned = phone.trim();
  for (const cc of COUNTRY_CODES) {
    if (cleaned.startsWith(cc.code)) return cc.code;
  }
  if (cleaned.startsWith("+")) {
    const match = cleaned.match(/^\+\d+/);
    return match ? match[0] : "+1";
  }
  return "+1";
}

function stripCountryCode(phone: string): string {
  for (const cc of COUNTRY_CODES) {
    if (phone.trim().startsWith(cc.code)) return phone.trim().slice(cc.code.length).trim();
  }
  const match = phone.trim().match(/^\+\d+/);
  if (match) return phone.trim().slice(match[0].length).trim();
  return phone.trim();
}

export function PersonalInfoSection({
  profile,
  session,
  avatarUrl,
  displayName,
  uploading,
  onAvatarDelete,
  onAvatarFileSelect,
  effectiveRole,
  displayRole,
  refresh,
  showToast,
}: {
  profile: AnyRecord | null;
  session: { user?: { name?: string; email?: string } } | null;
  avatarUrl: string;
  displayName: string;
  uploading: boolean;
  onAvatarDelete: () => void;
  onAvatarFileSelect: (file: File) => void;
  effectiveRole: string;
  displayRole: string;
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCountryCode, setEditCountryCode] = useState("+1");
  const [editDob, setEditDob] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editEmergencyCountryCode, setEditEmergencyCountryCode] = useState("+1");
  const [editBloodGroup, setEditBloodGroup] = useState("");
  const [editMaskPhone, setEditMaskPhone] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<"credentials" | "otp">("credentials");
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const oldName = profile?.name ? String(profile.name) : "";
  const oldPhone = profile?.phone ? String(profile.phone) : "";
  const oldDob = profile?.dob ? String(profile.dob).slice(0, 10) : "";
  const oldAddress = profile?.address ? String(profile.address) : "";
  const oldRegionLabel = profile?.regionLabel ? String(profile.regionLabel) : "";
  const oldEmergencyContact = profile?.emergencyContact ? String(profile.emergencyContact) : "";
  const oldBloodGroup = profile?.bloodGroup ? String(profile.bloodGroup) : "";
  const oldMaskPhone = profile?.maskPhone ? Boolean(profile.maskPhone) : false;

  function openModal() {
    setEditName(oldName);
    setEditPhone(stripCountryCode(oldPhone));
    setEditCountryCode(detectCountryCode(oldPhone));
    setEditDob(oldDob);
    setEditAddress(oldAddress);
    setEditEmergencyPhone(stripCountryCode(oldEmergencyContact));
    setEditEmergencyCountryCode(detectCountryCode(oldEmergencyContact));
    setEditBloodGroup(oldBloodGroup);
    setOpen(true);
    setConfirming(false);
  }

  function handleRequestSave(event: FormEvent) {
    event.preventDefault();
    setConfirming(true);
  }

  async   function openEmailModal() {
    setCurrentEmail(profile?.email ? String(profile.email) : "");
    setCurrentPassword("");
    setNewEmail("");
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpError("");
    setEmailStep("credentials");
    setEmailModalOpen(true);
  }

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setEmailSending(true);
    setOtpError("");
    try {
      await apiFetch("/api/profile/email/verify", {
        method: "POST",
        body: JSON.stringify({ currentEmail, currentPassword, newEmail }),
      });
      setEmailStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send OTP.", "error");
    } finally {
      setEmailSending(false);
    }
  }

  function handleOtpDigitChange(index: number, value: string) {
    if (value.length > 1) return;
    const next = [...otpDigits];
    next[index] = value.replace(/\D/g, "");
    setOtpDigits(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    const otp = otpDigits.join("");
    if (otp.length !== 6) return;
    setEmailSending(true);
    setOtpError("");
    try {
      await apiFetch("/api/profile/email/confirm", {
        method: "POST",
        body: JSON.stringify({ otp }),
      });
      setEmailModalOpen(false);
      await refresh(true);
      showToast("Email updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to verify OTP.";
      setOtpError(msg);
    } finally {
      setEmailSending(false);
    }
  }

  function closeEmailModal() {
    setEmailModalOpen(false);
  }

  async function handleConfirmSave() {
    setSaving(true);
    try {
      const fullPhone = editPhone ? `${editCountryCode} ${editPhone}` : "";
      const fullEmergency = editEmergencyPhone ? `${editEmergencyCountryCode} ${editEmergencyPhone}` : "";
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: editName, phone: fullPhone, dob: editDob || null, address: editAddress, emergencyContact: fullEmergency, bloodGroup: editBloodGroup, maskPhone: editMaskPhone }),
      });
      await refresh(true);
      setOpen(false);
      setConfirming(false);
      showToast("Personal info updated.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-[#000000] dark:border-zinc-800">
      <SectionHeader title="Personal Info" description="Basic details and identity" accent="indigo" />
      <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-zinc-700 dark:border-zinc-800/50">
        <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="md" />
        {avatarUrl ? (
          <button
            aria-label="Delete avatar"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 px-2.5 text-xs font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
            onClick={onAvatarDelete}
            title="Delete avatar"
            type="button"
          >
            <Trash2 size={13} />
            Delete Profile Image
          </button>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
            <Camera size={13} />
            {uploading ? "Uploading..." : "Upload avatar"}
            <input
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAvatarFileSelect(file);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        )}
        <button
          aria-label="Avatar upload restrictions"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-400"
          title="PNG, JPG, or WEBP only. Max size: 2MB."
          type="button"
        >
          <Info size={14} />
        </button>
      </div>
      <button
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        onClick={openModal}
        type="button"
      >
        <Pencil size={12} />
        Edit
      </button>
      <dl className="mt-3 space-y-3 text-sm">
        <Row label="Name" value={profile?.name ? String(profile.name) : session?.user?.name ? String(session.user.name) : undefined} />
        <div className="flex items-center justify-between">
          <Row label="Email" value={profile?.email ? String(profile.email) : session?.user?.email ? String(session.user.email) : undefined} />
          <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 shrink-0 ml-4" onClick={openEmailModal} type="button">
            Change
          </button>
        </div>
        <Row label="Email-Verified" value={profile?.emailVerified ? String(profile.emailVerified) : undefined} />
        <Row label="Phone" value={profile?.phone ? String(profile.phone) : undefined} />
        <Row label="Date of Birth" value={profile?.dob ? new Date(String(profile.dob)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined} />
        <Row label="Address" value={profile?.address ? String(profile.address) : undefined} />
        <Row label="Emergency Contact" value={profile?.emergencyContact ? String(profile.emergencyContact) : undefined} />
        <Row label="Blood Group" value={profile?.bloodGroup ? String(profile.bloodGroup) : undefined} />
        {oldRegionLabel ? <Row label="Region" value={oldRegionLabel} /> : null}
        <Row label="Role" value={effectiveRole ? displayRole : undefined} />
        <Row label="Unique Identity" value={profile?.companyIdentityCode ? String(profile.companyIdentityCode) : undefined} />
      </dl>
      {Array.isArray(profile?.roleHistory) && profile.roleHistory.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-zinc-800/50">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Role History</p>
          <div className="space-y-1.5">
            {(profile.roleHistory as { oldRole: string; newRole: string; changedBy: string; changedAt: string }[]).map((entry, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
                <span className="font-medium text-slate-700 dark:text-zinc-300">{entry.oldRole}</span>
                <span className="text-slate-300 dark:text-zinc-600">→</span>
                <span className="font-medium text-emerald-600">{entry.newRole}</span>
                <span className="ml-auto whitespace-nowrap text-slate-400 dark:text-zinc-500">{new Date(entry.changedAt).toLocaleDateString()}</span>
                <span className="text-slate-400 dark:text-zinc-500">by {entry.changedBy}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {open && !confirming ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-8 pb-8 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl my-auto dark:bg-[#000000]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Edit Personal Info</h2>
              <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-400" onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
            <form className="space-y-3 max-h-[60vh] overflow-y-auto pr-1" onSubmit={handleRequestSave}>
              <EditField label="Name" value={editName} onChange={setEditName} placeholder={oldName || "Your name"} required />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-7 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100"
                      value={editCountryCode}
                      onChange={(e) => setEditCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((cc) => (
                        <option key={cc.code} value={cc.code}>
                          {cc.flag} {cc.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
                    type="tel"
                    value={editPhone}
                    placeholder={stripCountryCode(oldPhone) || "Phone number"}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>
              <EditField label="Date of Birth" value={editDob} onChange={setEditDob} placeholder={oldDob || "YYYY-MM-DD"} type="date" />
              <EditField label="Address" value={editAddress} onChange={setEditAddress} placeholder={oldAddress || "Your address"} />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Emergency Contact</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-7 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-100"
                      value={editEmergencyCountryCode}
                      onChange={(e) => setEditEmergencyCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((cc) => (
                        <option key={cc.code} value={cc.code}>
                          {cc.flag} {cc.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-800 dark:text-zinc-100 dark:bg-transparent"
                    type="tel"
                    value={editEmergencyPhone}
                    placeholder={stripCountryCode(oldEmergencyContact) || "Emergency contact number"}
                    onChange={(e) => setEditEmergencyPhone(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">Blood Group</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-800 dark:text-zinc-100 dark:bg-[#000000]"
                  value={editBloodGroup}
                  onChange={(e) => setEditBloodGroup(e.target.value)}
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div className={`flex items-center justify-between rounded-lg border p-3 ${editPhone && editEmergencyPhone ? "border-slate-200 dark:border-zinc-800" : "border-slate-100 bg-slate-50 dark:border-zinc-800/50 dark:bg-zinc-700"}`}>
                <div>
                  <span className={`text-sm font-medium ${editPhone && editEmergencyPhone ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-500"}`}>Mask personal number on ID card</span>
                  <p className="text-xs text-slate-400">
                    {editPhone && editEmergencyPhone ? "Hides your phone number with asterisks" : "Add both phone and emergency contact to enable"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!editPhone || !editEmergencyPhone}
                  onClick={() => setEditMaskPhone(!editMaskPhone)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editMaskPhone ? "bg-indigo-600" : "bg-slate-300"} ${!editPhone || !editEmergencyPhone ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editMaskPhone ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  type="submit"
                >
                  Save
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Confirm modal */}
      {open && confirming ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-8 pb-8 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) { setConfirming(false); } }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl my-auto dark:bg-[#000000]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Is your data correct?</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">Please review before saving.</p>
            <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs dark:bg-zinc-700">
              <ConfirmRow label="Name" value={editName} />
              <ConfirmRow label="Phone" value={editCountryCode && editPhone ? `${editCountryCode} ${editPhone}` : editPhone || editCountryCode} />
              <ConfirmRow label="Date of Birth" value={editDob} />
              <ConfirmRow label="Address" value={editAddress} />
              {editEmergencyPhone ? <ConfirmRow label="Emergency Contact" value={`${editEmergencyCountryCode} ${editEmergencyPhone}`} /> : null}
              {editBloodGroup ? <ConfirmRow label="Blood Group" value={editBloodGroup} /> : null}
              <ConfirmRow label="Mask Phone" value={editMaskPhone ? "Yes" : "No"} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                onClick={() => setConfirming(false)}
                type="button"
              >
                Go Back
              </button>
              <button
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                disabled={saving}
                onClick={handleConfirmSave}
              >
                {saving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Email change modal */}
      {emailModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onClick={(e) => { if (e.target === e.currentTarget) closeEmailModal(); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-[#000000]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Change Email</h2>
              <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-400" onClick={closeEmailModal} type="button">
                <X size={16} />
              </button>
            </div>

            {emailStep === "credentials" ? (
              <form className="space-y-3" onSubmit={handleSendOtp}>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-500">Current Email</label>
                  <input
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 outline-none"
                    type="email"
                    value={currentEmail}
                    disabled
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-500">Current Password</label>
                  <input
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    type="password"
                    value={currentPassword}
                    required
                    placeholder="Enter your password"
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-500">New Email</label>
                  <input
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    type="email"
                    value={newEmail}
                    required
                    placeholder="Enter new email"
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={emailSending}
                  type="submit"
                >
                  <Mail size={15} />
                  {emailSending ? "Sending..." : "Send OTP"}
                </button>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={handleVerifyOtp}>
                <p className="text-xs text-slate-600">
                  Enter the 6-digit code sent to <strong className="text-slate-900">{newEmail}</strong>
                </p>
                <div className="flex justify-center gap-1.5">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      className="h-10 w-8 rounded-md border border-slate-200 text-center text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    />
                  ))}
                </div>
                {otpError ? (
                  <p className="text-center text-sm text-rose-600">{otpError}</p>
                ) : null}
                <button
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={emailSending || otpDigits.join("").length !== 6}
                  type="submit"
                >
                  {emailSending ? "Verifying..." : "Verify & Update"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-medium text-slate-500 shrink-0">{label}</span>
      <span className="text-right text-slate-900 break-words">{value || <span className="text-slate-300 italic">Not set</span>}</span>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}