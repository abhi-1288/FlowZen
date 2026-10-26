"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";
import type { FinanceData, ReportsData, LeaveImpact, PolicyData, PolicyApiResponse, SalaryCycleData } from "./types";

export function useFinanceData(month: string, showToast: (text: string, type?: "success" | "error") => void) {
  const [data, setData] = useState<FinanceData | null>(null);
  // Callers commonly pass an inline toast function. Keeping it in a ref means a
  // parent re-render can never restart this fetch and create a request loop.
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const load = useCallback(async () => {
    const result = await apiFetch<FinanceData>(`/api/finance?month=${month}`, undefined, { toast: false });
    setData(result);
  }, [month]);

  useEffect(() => {
    void load().catch(() => showToastRef.current("Unable to load finance data.", "error"));
  }, [load]);

  return { data, setData, load };
}

export function useInvoices(data: FinanceData | null, delegationId = "", enabled = true) {
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);

  useEffect(() => {
    if (!data || !enabled) {
      setInvoices([]);
      return;
    }
    let cancelled = false;
    const query = delegationId ? `?delegation=${encodeURIComponent(delegationId)}` : "";
    // `toast: false` is deliberate: an expected 403 must never raise a global
    // toast. A toast re-rendered this parent, which restarted this effect and
    // produced the endless /api/finance + /api/finance/invoice request storm.
    apiFetch<{ invoices: AnyRecord[] }>(`/api/finance/invoice${query}`, undefined, { toast: false })
      .then((res) => { if (!cancelled) setInvoices(res.invoices); })
      .catch(() => { if (!cancelled) setInvoices([]); });
    return () => { cancelled = true; };
  }, [data, delegationId, enabled]);

  return { invoices, setInvoices };
}

export function useReports(data: FinanceData | null) {
  const [reports, setReports] = useState<ReportsData | null>(null);

  useEffect(() => {
    if (!data) return;
    apiFetch<ReportsData>("/api/finance/reports", undefined, { toast: false })
      .then(setReports)
      .catch(() => { });
  }, [data]);

  return reports;
}

export function useLeaveImpacts(data: FinanceData | null, month: string) {
  const [leaveImpacts, setLeaveImpacts] = useState<LeaveImpact[]>([]);

  useEffect(() => {
    if (!data) return;
    apiFetch<{ impacts: LeaveImpact[] }>(`/api/finance/leave-impact?month=${month}`, undefined, { toast: false })
      .then((res) => setLeaveImpacts(res.impacts))
      .catch(() => { });
  }, [data, month]);

  return leaveImpacts;
}

export function usePolicyData(data: FinanceData | null) {
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  const loadPolicy = useCallback(async (region?: string) => {
    const query = region ? `?region=${encodeURIComponent(region)}` : "";
    const res = await apiFetch<PolicyApiResponse>(`/api/finance/policy${query}`, undefined, { toast: false });
    setPolicyData({
      foodAmount: res.foodAmount,
      travelAccommodationAmount: res.travelAccommodationAmount,
      foodOptedOutMembers: res.foodOptedOutMembers ?? [],
      travelOptedOutMembers: res.travelOptedOutMembers ?? [],
      advanceSalaryEnabled: res.advanceSalaryEnabled ?? false,
      autoSalaryEnabled: res.autoSalaryEnabled ?? false,
      pfPercentage: res.pfPercentage ?? 12,
      esicPercentage: res.esicPercentage ?? 0.75,
      tdsPercentage: res.tdsPercentage ?? 0,
    });
  }, []);

  useEffect(() => {
    if (!data) return;
    loadPolicy().catch(() => { });
  }, [data, loadPolicy]);

  const refreshPolicy = useCallback((region?: string) => loadPolicy(region), [loadPolicy]);

  return { policyData, setPolicyData, refreshPolicy };
}

export function useMySalarySlips(month: string) {
  const [mySlips, setMySlips] = useState<AnyRecord[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(true);

  useEffect(() => {
    setSlipsLoading(true);
    apiFetch<{ salaries: AnyRecord[] }>("/api/finance/salary-slip?employee=me", undefined, { toast: false })
      .then((res) => setMySlips(res.salaries ?? []))
      .catch(() => setMySlips([]))
      .finally(() => setSlipsLoading(false));
  }, [month]);

  return { mySlips, slipsLoading };
}

export function useSalaryCycle(data: FinanceData | null) {
  const [salaryCycle, setSalaryCycle] = useState<SalaryCycleData | null>(null);

  const refreshSalaryCycle = useCallback(async (region?: string) => {
    try {
      const query = region ? `?region=${encodeURIComponent(region)}` : "";
      const result = await apiFetch<SalaryCycleData>(`/api/finance/salary-cycle${query}`, undefined, { toast: false });
      setSalaryCycle(result);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    refreshSalaryCycle();
  }, [data, refreshSalaryCycle]);

  return { salaryCycle, setSalaryCycle, refreshSalaryCycle };
}
