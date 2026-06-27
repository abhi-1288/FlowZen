import { useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";

export function useSetupWizard(
  profile: AnyRecord | null,
  showToast: (text: string, type?: "success" | "error") => void,
  refresh: (silent?: boolean) => Promise<void>,
) {
  const { update: updateSession } = useSession();
  const [setupModal, setSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState<"send-otp" | "verify-otp" | "password" | "done">("send-otp");
  const [otpValue, setOtpValue] = useState(new Array(6).fill(""));
  const [setupRole, setSetupRole] = useState<string>("employee");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);

  const effectiveRole = profile?.role ? String(profile.role) : "";
  const isOAuthUnverified = effectiveRole === "others" && profile?.authProvider && String(profile.authProvider) !== "credentials" && !profile?.emailVerified;
  const showSetupBanner = isOAuthUnverified && !setupBannerDismissed;

  const accountAgeDays = profile?.createdAt
    ? Math.floor((Date.now() - new Date(String(profile.createdAt)).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const daysRemaining = Math.max(0, 15 - accountAgeDays);

  function openSetupModal() {
    setSetupStep("send-otp");
    setOtpValue(new Array(6).fill(""));
    setSetupRole("employee");
    setSetupPassword("");
    setSetupError("");
    setSetupModal(true);
  }

  function closeSetupModal() {
    setSetupModal(false);
    if (isOAuthUnverified) setSetupBannerDismissed(true);
  }

  async function sendOtp() {
    try {
      setSetupLoading(true);
      setSetupError("");
      await apiFetch("/api/auth/oauth/send-otp", { method: "POST" });
      setSetupStep("verify-otp");
      showToast("OTP sent to your email.");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Unable to send OTP.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifyOtp() {
    try {
      setSetupLoading(true);
      setSetupError("");
      await apiFetch("/api/auth/oauth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ otp: otpValue.join("") }),
      });
      setSetupStep("password");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Invalid OTP.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function completeSetup() {
    try {
      setSetupLoading(true);
      setSetupError("");
      const res = await apiFetch<{ ok: boolean; role: string }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ role: setupRole, newPassword: setupPassword }),
      });
      if (res?.ok) {
        setSetupStep("done");
        showToast(`Role updated.`);
        await refresh();
        await updateSession();
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Unable to complete setup.");
    } finally {
      setSetupLoading(false);
    }
  }

  return {
    setupModal, setSetupModal,
    setupStep, setSetupStep,
    otpValue, setOtpValue,
    setupRole, setSetupRole,
    setupPassword, setSetupPassword,
    setupLoading,
    setupError,
    setSetupBannerDismissed,
    isOAuthUnverified,
    showSetupBanner,
    accountAgeDays,
    daysRemaining,
    openSetupModal,
    closeSetupModal,
    sendOtp,
    verifyOtp,
    completeSetup,
  };
}
