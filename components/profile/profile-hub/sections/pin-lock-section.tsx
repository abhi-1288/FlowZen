"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { usePinLock } from "@/components/auth/pin-lock-provider";
import { ActionButton } from "../shared";
import { ConfirmActionModal } from "../modals/confirm-action-modal";

type PinStatus = { enabled: boolean; length: number | null };
type Mode = "idle" | "enable" | "change" | "disable";

function PinField({
  label,
  value,
  onChange,
  length,
  autoFocus,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  length: number;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      autoFocus={autoFocus}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      pattern="[0-9]*"
      maxLength={length}
      placeholder={label}
      type="password"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
      className="w-full rounded-lg border border-[var(--c-border-light)] px-3 py-2.5 tracking-[0.4em] dark:border-zinc-800 dark:bg-[#000000] disabled:opacity-60"
    />
  );
}

export function PinLockSection({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const pinLock = usePinLock();
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [length, setLength] = useState<4 | 6>(4);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | "enable" | "change" | "disable">(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiFetch<PinStatus>("/api/auth/pin/status", undefined, { toast: false });
      setStatus({ enabled: Boolean(data.enabled), length: data.length ?? null });
      if (data.length === 4 || data.length === 6) setLength(data.length);
    } catch {
      setStatus({ enabled: false, length: null });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus();
  }, [loadStatus]);

  function resetFields() {
    setCurrentPin("");
    setPin("");
    setConfirmPin("");
    setError("");
  }

  function startMode(next: Exclude<Mode, "idle">) {
    resetFields();
    setMode(next);
    if (next === "disable") setLength(status?.length === 6 ? 6 : 4);
  }

  function requestSubmit() {
    setError("");
    const enabled = status?.enabled ?? false;
    const requiredLength = enabled && mode === "change" ? (status?.length ?? length) : length;
    if (pin.length !== requiredLength || confirmPin.length !== requiredLength) {
      setError(`PIN must be exactly ${requiredLength} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      setError("The two PINs do not match.");
      return;
    }
    if (enabled && currentPin.length === 0) {
      setError("Enter your current PIN.");
      return;
    }
    setConfirmAction(enabled ? "change" : "enable");
  }

  function requestDisable() {
    setError("");
    if (currentPin.length !== (status?.length ?? 4)) {
      setError("Enter your current PIN.");
      return;
    }
    setConfirmAction("disable");
  }

  async function performConfirmed() {
    const action = confirmAction;
    if (!action) return;
    setLoading(true);
    setError("");
    try {
      if (action === "disable") {
        await apiFetch("/api/auth/pin/disable", {
          method: "DELETE",
          body: JSON.stringify({ currentPin }),
        }, { toast: false });
      } else {
        await apiFetch("/api/auth/pin/setup", {
          method: "POST",
          body: JSON.stringify({
            pin,
            currentPin: action === "change" ? currentPin : undefined,
          }),
        }, { toast: false });
      }
      await loadStatus();
      await pinLock.refresh();
      resetFields();
      setMode("idle");
      setConfirmAction(null);
      showToast(action === "disable" ? "Green PIN screen lock turned off." : "Green PIN screen lock updated.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Something went wrong.";
      setConfirmAction(null);
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  const enabled = status?.enabled ?? false;
  const configuredLength = status?.length ?? 4;

  return (
    <div className="mt-5 border-t border-[var(--c-border-light)] pt-5 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {enabled ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldOff size={16} className="text-muted" />}
            Green PIN screen lock
          </h4>
          <p className="mt-0.5 text-body text-muted">
            {enabled
              ? `Locked automatically after 15 minutes of inactivity. Currently a ${configuredLength}-digit Green PIN.`
              : "Require a Green PIN to unlock this device after 15 minutes of inactivity."}
          </p>
        </div>
      </div>

      {mode === "idle" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {enabled ? (
            <>
              <ActionButton variant="primary" onClick={() => startMode("change")}>
                <KeyRound size={16} /> Change PIN
              </ActionButton>
              <ActionButton variant="danger" onClick={() => startMode("disable")}>
                <ShieldOff size={16} /> Turn off
              </ActionButton>
            </>
          ) : (
            <ActionButton variant="primary" onClick={() => startMode("enable")}>
              <Lock size={16} /> Set up PIN
            </ActionButton>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {mode !== "change" && mode !== "disable" ? (
            <div className="flex items-center gap-2">
              <span className="text-body text-muted">Length</span>
              {[4, 6].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setLength(option as 4 | 6);
                    setPin("");
                    setConfirmPin("");
                  }}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    length === option
                      ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-[var(--c-border-light)] text-muted dark:border-zinc-800"
                  }`}
                >
                  {option} digits
                </button>
              ))}
            </div>
          ) : null}

          {mode === "change" || mode === "disable" ? (
            <PinField
              label="Current Green PIN"
              value={currentPin}
              onChange={setCurrentPin}
              length={configuredLength}
              autoFocus
              disabled={loading}
            />
          ) : null}

          {mode !== "disable" ? (
            <>
              <PinField
                label={`New ${length}-digit Green PIN`}
                value={pin}
                onChange={setPin}
                length={length}
                autoFocus={mode === "enable"}
                disabled={loading}
              />
              <PinField
                label="Confirm new Green PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                length={length}
                disabled={loading}
              />
            </>
          ) : null}

          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {mode === "disable" ? (
              <ActionButton variant="danger" disabled={loading} onClick={requestDisable}>
                <ShieldOff size={16} /> Turn off PIN
              </ActionButton>
            ) : (
              <ActionButton variant="primary" disabled={loading} onClick={requestSubmit}>
                <KeyRound size={16} /> {mode === "change" ? "Save new PIN" : "Set PIN"}
              </ActionButton>
            )}
            <ActionButton
              variant="ghost"
              disabled={loading}
              onClick={() => {
                resetFields();
                setMode("idle");
              }}
            >
              Cancel
            </ActionButton>
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={confirmAction !== null}
        noInput
        title={confirmAction === "disable" ? "Turn off PIN lock?" : confirmAction === "change" ? "Change your PIN?" : "Set up PIN lock?"}
        description={
          confirmAction === "disable" ? (
            <p>This device will no longer require a PIN after periods of inactivity.</p>
          ) : confirmAction === "change" ? (
            <p>Your other signed-in devices will be locked and require the new PIN. Keep it somewhere safe.</p>
          ) : (
            <p>You&apos;ll need this PIN to unlock the app after 15 minutes of inactivity. It cannot be recovered, only changed.</p>
          )
        }
        loading={loading}
        confirmLabel={confirmAction === "disable" ? "Turn off" : "Confirm"}
        onConfirm={() => void performConfirmed()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
