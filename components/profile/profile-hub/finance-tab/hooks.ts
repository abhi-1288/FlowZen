"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";
import type { FinanceData, ReportsData, LeaveImpact, PolicyData, PolicyApiResponse, SalaryCycleData } from "./types";

export function useFinanceData(month: string, showToast: (text: string, type?: "success" | "error") => void) {
  const [data, setData] = useState<FinanceData | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<FinanceData>(`/api/finance?month=${month}`);
    setData(result);
  }, [month]);

  useEffect(() => {
    void load().catch(() => showToast("Unable to load finance data.", "error"));
  }, [load, showToast]);

  return { data, setData, load };
}

export function useInvoices(data: FinanceData | null) {
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);

  useEffect(() => {
    if (!data) return;
    apiFetch<{ invoices: AnyRecord[] }>("/api/finance/invoice")
      .then((res) => setInvoices(res.invoices))
      .catch(() => { });
  }, [data]);

  return { invoices, setInvoices };
}

export function useReports(data: FinanceData | null) {
  const [reports, setReports] = useState<ReportsData | null>(null);

  useEffect(() => {
    if (!data) return;
    apiFetch<ReportsData>("/api/finance/reports")
      .then(setReports)
      .catch(() => { });
  }, [data]);

  return reports;
}

export function useLeaveImpacts(data: FinanceData | null, month: string) {
  const [leaveImpacts, setLeaveImpacts] = useState<LeaveImpact[]>([]);

  useEffect(() => {
    if (!data) return;
    apiFetch<{ impacts: LeaveImpact[] }>(`/api/finance/leave-impact?month=${month}`)
      .then((res) => setLeaveImpacts(res.impacts))
      .catch(() => { });
  }, [data, month]);

  return leaveImpacts;
}

export function usePolicyData(data: FinanceData | null) {
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  useEffect(() => {
    if (!data) return;
    apiFetch<PolicyApiResponse>("/api/finance/policy")
      .then((res) => setPolicyData({
        foodAmount: res.foodAmount,
        travelAccommodationAmount: res.travelAccommodationAmount,
        foodOptedOutMembers: res.foodOptedOutMembers ?? [],
        travelOptedOutMembers: res.travelOptedOutMembers ?? [],
        advanceSalaryEnabled: res.advanceSalaryEnabled ?? false,
        pfPercentage: res.pfPercentage ?? 12,
        esicPercentage: res.esicPercentage ?? 0.75,
        tdsPercentage: res.tdsPercentage ?? 0,
      }))
      .catch(() => { });
  }, [data]);

  return { policyData, setPolicyData };
}

export function useMySalarySlips(month: string) {
  const [mySlips, setMySlips] = useState<AnyRecord[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(true);

  useEffect(() => {
    setSlipsLoading(true);
    apiFetch<{ salaries: AnyRecord[] }>("/api/finance/salary-slip?employee=me")
      .then((res) => setMySlips(res.salaries ?? []))
      .catch(() => setMySlips([]))
      .finally(() => setSlipsLoading(false));
  }, [month]);

  return { mySlips, slipsLoading };
}

export function useSalaryCycle(data: FinanceData | null) {
  const [salaryCycle, setSalaryCycle] = useState<SalaryCycleData | null>(null);

  const refreshSalaryCycle = useCallback(async () => {
    try {
      const result = await apiFetch<SalaryCycleData>("/api/finance/salary-cycle");
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
