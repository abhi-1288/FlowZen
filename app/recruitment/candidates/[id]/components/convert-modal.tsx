"use client";

import { useEffect, useState } from "react";
import { X, Eye, EyeOff, Info } from "lucide-react";
import type { ConvertEmailInfo } from "@/store/recruitment-store";

const ROLE_OPTIONS = [
  { value: "others", label: "Others" },
  { value: "employee", label: "Employee" },
  { value: "project-manager", label: "Project Manager" },
  { value: "qa-tester", label: "QA Tester" },
  { value: "human-resource", label: "Human Resource" },
  { value: "finance", label: "Finance" },
  { value: "security", label: "Junior Security" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConvertEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
  onLookupEmail,
  onSendOtp,
  candidateName,
  candidateEmail,
  isSeniorSecurity,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string, role: string, email: string, otp?: string) => Promise<void>;
  onLookupEmail: (email: string) => Promise<ConvertEmailInfo>;
  onSendOtp: (email: string) => Promise<void>;
  candidateName: string;
  candidateEmail: string;
  isSeniorSecurity?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("others");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [email, setEmail] = useState(candidateEmail);
  const [originalInfo, setOriginalInfo] = useState<ConvertEmailInfo | null>(null);
  const [newEmailInfo, setNewEmailInfo] = useState<ConvertEmailInfo | null>(null);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(true);
  const [actionError, setActionError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCandidateEmail = candidateEmail.trim().toLowerCase();
  const emailChanged = normalizedEmail !== normalizedCandidateEmail;

  useEffect(() => {
    if (!isOpen) return;
    setPassword("");
    setConfirmPassword("");
    setSelectedRole("others");
    setEmail(candidateEmail);
    setOtp("");
    setOtpSent(false);
    setActionError("");
    setNewEmailInfo(null);
    setOriginalInfo(null);
    setCheckingEmail(true);
    let cancelled = false;
    (async () => {
      try {
        const info = await onLookupEmail(candidateEmail);
        if (!cancelled) setOriginalInfo(info);
      } catch {
        if (!cancelled) setOriginalInfo(null);
      } finally {
        if (!cancelled) setCheckingEmail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, candidateEmail, onLookupEmail]);

  function resetForm() {
    setPassword("");
    setConfirmPassword("");
    setSelectedRole("others");
    setEmail(candidateEmail);
    setOtp("");
    setOtpSent(false);
    setActionError("");
    setNewEmailInfo(null);
    setCheckingEmail(true);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setOtp("");
    setOtpSent(false);
    setActionError("");
    setNewEmailInfo(null);
  }

  async function handleEmailBlur() {
    if (!EMAIL_RE.test(normalizedEmail)) return;
    if (normalizedEmail === normalizedCandidateEmail) return;
    try {
      const info = await onLookupEmail(normalizedEmail);
      setNewEmailInfo(info.exists ? info : null);
    } catch {
      setNewEmailInfo(null);
    }
  }

  async function handleSendOtp() {
    if (!EMAIL_RE.test(normalizedEmail)) {
      setActionError("Enter a valid email address.");
      return;
    }
    if (!emailChanged) {
      setActionError("Choose a different email before requesting a code.");
      return;
    }
    setSendingOtp(true);
    setActionError("");
    try {
      await onSendOtp(normalizedEmail);
      setOtpSent(true);
      setOtp("");
      setNewEmailInfo(null);
    } catch (e: any) {
      setActionError(e?.message || "Unable to send verification code.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSubmit() {
    if (password.length < 6) return;
    if (password !== confirmPassword) return;
    if (emailChanged && (!otpSent || !/^\d{6}$/.test(otp))) return;
    setSubmitting(true);
    setActionError("");
    try {
      await onSubmit(password, selectedRole, normalizedEmail, emailChanged ? otp : undefined);
      resetForm();
      onClose();
    } catch (e: any) {
      setActionError(e?.message || "Conversion failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const canSubmit =
    !submitting &&
    !checkingEmail &&
    password.length >= 6 &&
    password === confirmPassword &&
    (!emailChanged || (otpSent && /^\d{6}$/.test(otp)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay">
      <div className="w-full max-w-md rounded-2xl bg-[var(--c-bg-card)] p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Convert To Employee</h2>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg p-1 text-slate-400 hover:bg-[var(--c-bg-muted)] hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Set a password for {candidateName}. A welcome email with login credentials will be sent to the account email.
          </p>
          {checkingEmail && (
            <p className="text-xs text-slate-400">Checking this email against existing accounts...</p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              disabled={checkingEmail}
              className="neu-inset w-full rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="name@example.com"
            />
            {emailChanged && (
              <p className="mt-1 text-xs text-slate-400">
                Changing the email creates a new account. The original email stays on the candidate record.
              </p>
            )}
          </div>

          {originalInfo?.exists && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Info size={13} /> An account with this email already exists
              </p>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-amber-800">
                <span className="text-amber-600">Email</span>
                <span className="truncate">{originalInfo.user?.email}</span>
                <span className="text-amber-600">Username</span>
                <span className="truncate">{originalInfo.user?.name}</span>
                <span className="text-amber-600">Company</span>
                <span className="truncate">{originalInfo.user?.companyName || "—"}</span>
                <span className="text-amber-600">Unique ID</span>
                <span className="truncate">{originalInfo.user?.companyIdentityCode || "—"}</span>
                <span className="text-amber-600">Status</span>
                <span className="truncate capitalize">{originalInfo.user?.companyStatus}</span>
              </div>
              <p className="mt-2 text-[11px] text-amber-700">
                Keeping this email reuses the existing account. To start fresh, change the account email above.
              </p>
            </div>
          )}

          {emailChanged && (
            <div className="rounded-lg border border-[var(--c-border-light)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {otpSent
                    ? `Verification code sent to ${normalizedEmail}.`
                    : "A verification code is required for the new email."}
                </p>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || checkingEmail}
                  className="shrink-0 rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-[var(--c-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingOtp ? "Sending..." : otpSent ? "Resend Code" : "Send OTP"}
                </button>
              </div>
              {otpSent && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Verification Code</label>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    disabled={checkingEmail}
                    className="neu-inset w-full rounded-lg px-3 py-2 text-sm tracking-[0.4em] disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="000000"
                  />
                </div>
              )}
            </div>
          )}

          {newEmailInfo?.exists && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              This email is already registered. Choose a different email.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={isSeniorSecurity || checkingEmail}
              className="neu-inset w-full rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {isSeniorSecurity && (
              <p className="mt-1 text-xs text-slate-400">Senior security can only convert to Junior Security.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Set Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={checkingEmail}
                className="neu-inset w-full rounded-lg px-3 py-2 pr-10 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={checkingEmail}
                className="neu-inset w-full rounded-lg px-3 py-2 pr-10 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Confirm password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
          {actionError && <p className="text-xs text-red-500">{actionError}</p>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Converting..." : "Convert & Send Welcome Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
