"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiFetch } from "@/lib/client-utils";
import { Card, SectionHeader } from "./shared";
import type { PolicyData } from "./finance-tab/types";
import { ShieldCheck, Percent, Info } from "lucide-react";

export function FinancePolicyTab({
  actorRole,
  profileId,
  showToast,
}: {
  actorRole: string;
  profileId: string;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  // Form states
  const [pfPct, setPfPct] = useState("12");
  const [esicPct, setEsicPct] = useState("0.75");
  const [tdsPct, setTdsPct] = useState("0");
  const [advanceSalaryEnabled, setAdvanceSalaryEnabled] = useState(false);
  
  const [houseRentPct, setHouseRentPct] = useState("37.33");
  const [conveyancePct, setConveyancePct] = useState("5.92");
  const [medicalPct, setMedicalPct] = useState("4.63");
  const [specialAllowancePct, setSpecialAllowancePct] = useState("74.33");

  // Calculator state
  const [testGross, setTestGross] = useState("50000");

  useEffect(() => {
    setLoading(true);
    apiFetch<PolicyData>("/api/finance/policy")
      .then((data) => {
        setPolicyData(data);
        setPfPct(String(data.pfPercentage ?? 12));
        setEsicPct(String(data.esicPercentage ?? 0.75));
        setTdsPct(String(data.tdsPercentage ?? 0));
        setAdvanceSalaryEnabled(Boolean(data.advanceSalaryEnabled));
        setHouseRentPct(String(data.houseRentPercentage ?? 37.33));
        setConveyancePct(String(data.conveyancePercentage ?? 5.92));
        setMedicalPct(String(data.medicalPercentage ?? 4.63));
        setSpecialAllowancePct(String(data.specialAllowancePercentage ?? 74.33));
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : "Failed to load policy data.", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        pfPercentage: Number(pfPct),
        esicPercentage: Number(esicPct),
        tdsPercentage: Number(tdsPct),
        advanceSalaryEnabled,
        houseRentPercentage: Number(houseRentPct),
        conveyancePercentage: Number(conveyancePct),
        medicalPercentage: Number(medicalPct),
        specialAllowancePercentage: Number(specialAllowancePct),
      };

      const res = await apiFetch<PolicyData>("/api/finance/policy", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setPolicyData(res);
      showToast("Finance policies successfully updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update policies.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Math for the live calculator preview
  const hr = Number(houseRentPct) || 0;
  const cv = Number(conveyancePct) || 0;
  const md = Number(medicalPct) || 0;
  const sp = Number(specialAllowancePct) || 0;
  const grossInput = Number(testGross) || 0;

  const sumPct = 1 + (hr + cv + md + sp) / 100;
  const calcBasic = sumPct > 0 ? Math.round(grossInput / sumPct) : 0;
  const calcHra = Math.round((calcBasic * hr) / 100);
  const calcConv = Math.round((calcBasic * cv) / 100);
  const calcMed = Math.round((calcBasic * md) / 100);
  const calcSpecial = Math.max(0, grossInput - (calcBasic + calcHra + calcConv + calcMed));

  const totalSum = calcBasic + calcHra + calcConv + calcMed + calcSpecial;

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading policy settings...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        {/* Policy Configuration Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <SectionHeader
              title="Finance Policy Configurations"
              description="Manage deductions, advance salary requests, and component breakdown percentages."
              accent="indigo"
            />

            <div className="mt-4 space-y-4">
              {/* Deduction Percentages */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <Percent size={14} className="text-indigo-500 dark:text-indigo-400" /> Statutory Deductions
                </h4>
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 p-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">PF (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={pfPct}
                      onChange={(e) => setPfPct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">ESIC (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={esicPct}
                      onChange={(e) => setEsicPct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">TDS (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={tdsPct}
                      onChange={(e) => setTdsPct(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Advance Salary */}
              <div className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 p-3.5">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Advance Salary Requests</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500">Allow employees to request salary advances directly</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      advanceSalaryEnabled
                        ? "bg-slate-950 dark:bg-white text-white dark:text-zinc-900 shadow-sm"
                        : "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    }`}
                    onClick={() => setAdvanceSalaryEnabled(true)}
                  >
                    Enabled
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      !advanceSalaryEnabled
                        ? "bg-slate-950 dark:bg-white text-white dark:text-zinc-900 shadow-sm"
                        : "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    }`}
                    onClick={() => setAdvanceSalaryEnabled(false)}
                  >
                    Disabled
                  </button>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-indigo-500 dark:text-indigo-400" /> Earning Breakdown Percentages (% of Basic)
                </h4>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 p-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">House Rent Allowance (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={houseRentPct}
                      onChange={(e) => setHouseRentPct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">Conveyance Allowance (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={conveyancePct}
                      onChange={(e) => setConveyancePct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">Medical Allowance (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={medicalPct}
                      onChange={(e) => setMedicalPct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1 block">Special Allowance (%)</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold focus:border-indigo-400 focus:outline-none text-slate-900 dark:text-zinc-100"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={specialAllowancePct}
                      onChange={(e) => setSpecialAllowancePct(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 dark:text-zinc-500 flex items-start gap-1">
                  <Info size={12} className="shrink-0 mt-0.5 text-slate-500 dark:text-zinc-500" />
                  These percentages will dynamically segment an employee's monthly gross base salary into pro-rata components on their salary slips.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving Changes..." : "Save Policies"}
                </button>
              </div>
            </div>
          </Card>
        </form>
      </div>

      <div className="space-y-6">
        {/* Live Salary Breakdown Calculator */}
        <Card>
          <SectionHeader
            title="Breakdown Preview Calculator"
            description="Type a mock Gross Salary to preview how it breaks down with the active configured percentages."
            accent="emerald"
          />

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1.5 block">Enter Gross Salary (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400 dark:text-zinc-500">₹</span>
                <input
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-7 pr-3 py-2 text-sm font-bold text-slate-900 dark:text-zinc-100 focus:border-emerald-400 focus:outline-none"
                  type="number"
                  min="0"
                  value={testGross}
                  onChange={(e) => setTestGross(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 dark:border-zinc-800 bg-emerald-50/10 dark:bg-emerald-950/20 p-4 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
                <span>Components</span>
                <span>Calculated Amount</span>
              </div>
              <hr className="border-slate-100 dark:border-zinc-800" />
              
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600 dark:text-zinc-400">Basic Salary Component (Derived)</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">₹{calcBasic.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600 dark:text-zinc-400">House Rent Allowance ({hr}%)</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">₹{calcHra.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600 dark:text-zinc-400">Conveyance Allowance ({cv}%)</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">₹{calcConv.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600 dark:text-zinc-400">Medical Allowance ({md}%)</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">₹{calcMed.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600 dark:text-zinc-400">Special Allowance ({sp}%)</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100">₹{calcSpecial.toLocaleString("en-IN")}</span>
              </div>

              <hr className="border-slate-100 dark:border-zinc-800" />
              <div className="flex justify-between items-center text-sm font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg">
                <span>Sum of Components:</span>
                <span>₹{totalSum.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 p-3 text-[11px] text-indigo-900 dark:text-indigo-300 flex gap-2">
              <Info size={16} className="shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div>
                <span className="font-bold">Formula:</span> Basic Salary is derived as <code className="bg-white dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px] text-indigo-800 dark:text-indigo-300">Gross / (1 + (HRA% + Conveyance% + Medical% + Special%) / 100)</code>. Other components are computed as their percentages of Basic, with Special Allowance taking the balance.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
