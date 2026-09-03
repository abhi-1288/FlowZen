import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

type AnyRecord = Record<string, any>;

const LETTER_LABELS: Record<string, string> = {
  experience: "Experience Certificate",
  "salary-certificate": "Salary Certificate",
  "offer-letter": "Offer Letter",
  relieving: "Relieving Letter",
  internship: "Internship Certificate",
  resignation: "Resignation Letter",
  "final-settlement": "Final Settlement Letter",
  "form-16": "Form 16",
  noc: "NOC Paper",
  "exit-agreement": "Exit Agreement",
  "employee-recognition": "Employee Recognition Letter",
  other: "Certificate",
};

export function MyLetters({ currentUserId }: { currentUserId: string }) {
  const [letters, setLetters] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<{ requests: AnyRecord[] }>("/api/hr/document-letter")
      .then((res) => {
        const own = (res.requests ?? []).filter((req) => {
          const rid =
            (req.requester as AnyRecord)?._id ??
            (req.requester as AnyRecord)?.id ??
            req.requester;
          return String(rid) === currentUserId;
        });
        if (active) setLetters(own);
      })
      .catch(() => {
        if (active) setLetters([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUserId]);

  return (
    <div className="rounded-xl neu-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FileText size={16} className="text-slate-500" />
        My Letters
      </h2>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : letters.length > 0 ? (
        <div className="space-y-2">
          {letters.map((req) => {
            const letterType = String((req.metadata as AnyRecord)?.letterType ?? "");
            const label = LETTER_LABELS[letterType] ?? letterType.replace("-", " ");
            const status = String(req.status ?? "");
            const reqId = String(req._id ?? req.id ?? "");
            const isApproved = status === "approved";
            return (
              <div
                key={reqId}
                className="flex items-center justify-between gap-3 rounded-lg neu-inset px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">
                    {req.createdAt
                      ? new Date(String(req.createdAt)).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}
                    <span
                      className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        backgroundColor:
                          status === "rejected" ? "#fee2e2" : status === "approved" ? "#dcfce7" : "#fef3c7",
                        color:
                          status === "rejected" ? "#991b1b" : status === "approved" ? "#166534" : "#92400e",
                      }}
                    >
                      {status}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {isApproved ? (
                    <a
                      href={`/letter/${reqId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neu-btn neu-btn-primary shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">You have no document requests.</p>
      )}
    </div>
  );
}
