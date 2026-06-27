import { Card, SectionHeader } from "../../shared";
import type { PolicyData } from "../types";

export function PoliciesSection({
  policyData,
  foodOptedIn,
  travelOptedIn,
  onToggleOptInOut,
}: {
  policyData: PolicyData | null;
  foodOptedIn: boolean;
  travelOptedIn: boolean;
  onToggleOptInOut: (type: "food" | "travel", optedIn: boolean) => void;
}) {
  if (!policyData || (policyData.foodAmount <= 0 && policyData.travelAccommodationAmount <= 0)) return null;

  return (
    <Card>
      <SectionHeader title="Company Policies" description="Fixed deductions configured by finance. Opt in/out separately below." accent="amber" />
      <div className="mt-3 space-y-2">
        {policyData.foodAmount > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Food Allowance (&#x20B9;{policyData.foodAmount})</p>
              <p className="text-xs text-slate-500">Fixed deduction from salary</p>
            </div>
            <div className="flex gap-2">
              <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${foodOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("food", true)}>Active</button>
              <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!foodOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("food", false)}>Opt Out</button>
            </div>
          </div>
        ) : null}
        {policyData.travelAccommodationAmount > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">Travel Accommodation (&#x20B9;{policyData.travelAccommodationAmount})</p>
              <p className="text-xs text-slate-500">Fixed deduction from salary</p>
            </div>
            <div className="flex gap-2">
              <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${travelOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("travel", true)}>Active</button>
              <button className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!travelOptedIn ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`} onClick={() => onToggleOptInOut("travel", false)}>Opt Out</button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
