import { Check } from "lucide-react";
import { formatRole } from "../shared";
import type { AnyRecord } from "../shared";

type SetupStep = "send-otp" | "verify-otp" | "password" | "done";

export function SetupModal({
  open,
  profile,
  step,
  otpValue,
  onOtpChange,
  setupRole,
  onRoleChange,
  setupPassword,
  onPasswordChange,
  loading,
  error,
  onClose,
  onSendOtp,
  onVerifyOtp,
  onCompleteSetup,
}: {
  open: boolean;
  profile: AnyRecord | null;
  step: SetupStep;
  otpValue: string[];
  onOtpChange: (otp: string[]) => void;
  setupRole: string;
  onRoleChange: (role: string) => void;
  setupPassword: string;
  onPasswordChange: (password: string) => void;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSendOtp: () => Promise<void>;
  onVerifyOtp: () => Promise<void>;
  onCompleteSetup: () => Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#000000]">
        {step === "send-otp" ? (
          <>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Verify your email</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              We'll send a 6-digit OTP to <strong>{String(profile?.email ?? "")}</strong> to verify your account.
            </p>
            {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-zinc-800" onClick={onClose} type="button">Cancel</button>
              <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={loading} onClick={() => void onSendOtp()} type="button">
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </div>
          </>
        ) : null}

        {step === "verify-otp" ? (
          <>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Enter OTP</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Enter the 6-digit code sent to <strong>{String(profile?.email ?? "")}</strong>.</p>
            {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950">{error}</p> : null}
            <div className="mt-4 flex items-center justify-between gap-2">
              {otpValue.map((digit, index) => (
                <input
                  key={index}
                  className="h-12 w-12 rounded-xl border border-slate-300 text-center text-lg font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  id={`setup-otp-${index}`}
                  maxLength={1}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!/^\d?$/.test(value)) return;
                    const newOtp = [...otpValue];
                    newOtp[index] = value;
                    onOtpChange(newOtp);
                    if (value && index < 5) { document.getElementById(`setup-otp-${index + 1}`)?.focus(); }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otpValue[index] && index > 0) { document.getElementById(`setup-otp-${index - 1}`)?.focus(); }
                  }}
                  onPaste={(e) => {
                    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                    if (paste.length === 6) { onOtpChange(paste.split("")); setTimeout(() => document.getElementById("setup-otp-5")?.focus(), 0); }
                    e.preventDefault();
                  }}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                />
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-zinc-800" onClick={onClose} type="button">Cancel</button>
              <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={loading || otpValue.join("").length !== 6} onClick={() => void onVerifyOtp()} type="button">
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </>
        ) : null}

        {step === "password" ? (
          <>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Set password & choose role</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Create a password and select your role to complete setup.</p>
            {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950">{error}</p> : null}
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Role</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#000000]" value={setupRole} onChange={(e) => onRoleChange(e.target.value)}>
                  <option value="employee">Employee</option>
                  <option value="project-manager">Project Manager</option>
                  <option value="qa-tester">QA Tester</option>
                  <option value="human-resource">Human Resource</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-400">Password</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#000000]" minLength={8} placeholder="At least 8 characters" type="password" value={setupPassword} onChange={(e) => onPasswordChange(e.target.value)} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-zinc-800" onClick={onClose} type="button">Cancel</button>
              <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={loading || setupPassword.length < 8} onClick={() => void onCompleteSetup()} type="button">
                {loading ? "Saving..." : "Complete setup"}
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <div className="flex flex-col items-center py-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={28} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-zinc-100">Setup complete!</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Your role has been set to <strong>{formatRole(setupRole)}</strong>.</p>
            </div>
            <div className="mt-5 flex justify-end">
              <button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={onClose} type="button">Done</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
