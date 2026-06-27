import type { WorkflowStatus } from "@/lib/recruitment-types";

const STYLES: Record<WorkflowStatus, { bg: string; text: string; label: string }> = {
  requested: { bg: "bg-slate-100", text: "text-slate-600", label: "Requested" },
  assigned: { bg: "bg-blue-50", text: "text-blue-700", label: "Assigned" },
  drafting: { bg: "bg-amber-50", text: "text-amber-700", label: "Drafting" },
  "salary-pending": { bg: "bg-purple-50", text: "text-purple-700", label: "Salary Pending" },
  "salary-approved": { bg: "bg-indigo-50", text: "text-indigo-700", label: "Salary Approved" },
  "draft-ready": { bg: "bg-cyan-50", text: "text-cyan-700", label: "Draft Ready" },
  published: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Published" },
  rejected: { bg: "bg-rose-50", text: "text-rose-700", label: "Rejected" },
};

export function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  const s = STYLES[status] ?? STYLES.requested;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
