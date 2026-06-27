import { Check } from "lucide-react";
import type { Workflow } from "@/lib/recruitment-types";

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "assigned", label: "Assigned" },
  { key: "drafting", label: "Drafting" },
  { key: "salary-pending", label: "Salary Pending" },
  { key: "salary-approved", label: "Salary Approved" },
  { key: "draft-ready", label: "Draft Ready" },
  { key: "published", label: "Published" },
];

const STATUS_ORDER: Record<string, number> = {
  requested: 0,
  assigned: 1,
  drafting: 2,
  "salary-pending": 3,
  "salary-approved": 4,
  "draft-ready": 5,
  published: 6,
  rejected: -1,
};

export function WorkflowTimeline({ workflow }: { workflow: Workflow }) {
  const currentIdx = STATUS_ORDER[workflow.status] ?? -1;
  const isRejected = workflow.status === "rejected";

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const completed = i <= currentIdx && !isRejected;
        const active = i === currentIdx && !isRejected;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  completed
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "border-2 border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-2 border-slate-200 bg-white text-slate-400"
                }`}
              >
                {completed ? <Check size={12} /> : i + 1}
              </div>
              <span className={`whitespace-nowrap text-[10px] font-medium ${
                active ? "text-indigo-700" : completed ? "text-emerald-600" : "text-slate-400"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 mt-[-1.5rem] h-0.5 flex-1 ${
                i < currentIdx && !isRejected ? "bg-emerald-500" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
      {isRejected && (
        <div className="flex flex-1 items-center">
          <div className="mx-1 h-0.5 flex-1 bg-rose-300" />
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">!</div>
            <span className="whitespace-nowrap text-[10px] font-medium text-rose-600">Rejected</span>
          </div>
        </div>
      )}
    </div>
  );
}
