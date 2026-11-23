import { FolderOpen } from "lucide-react";
import { ActionButton } from "../../shared";
import type { DocModalData } from "../types";
import { MemberActionModal } from "./member-action-modal";

export function DocumentsModal({
  member,
  loading,
  data,
  onClose,
}: {
  member: { id?: string; name?: string } | null;
  loading: boolean;
  data: DocModalData | null;
  onClose: () => void;
}) {
  if (!member) return null;

  return (
    <MemberActionModal
      title="Documents"
      icon={<FolderOpen size={15} />}
      panelClassName="max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <p className="text-xs text-slate-500">
          Documents uploaded by <strong>{String(member.name ?? "")}</strong>.
      </p>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : data ? (
            data.categories.length === 0 ? (
              <p className="text-sm text-slate-400">No document categories defined.</p>
            ) : (
              data.categories.map((cat) => {
                const doc = data.documents.find((d) => d.category === cat.name);
                return (
                  <div key={cat.name} className="rounded-lg neu-inset p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cat.mandatory ? "bg-rose-100 text-rose-700" : "bg-slate-50 text-slate-600 dark:bg-zinc-800/60 dark:text-zinc-300"}`}>
                            {cat.mandatory ? "Required" : "Optional"}
                          </span>
                        </div>
                        {doc ? (
                          <p className="mt-0.5 text-xs text-slate-500 truncate">{doc.fileName} ({(doc.fileSize / 1024).toFixed(0)} KB)</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-400">Not uploaded</p>
                        )}
                      </div>
                      {doc ? (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="rounded-md neu-card px-3 py-1 text-[11px] font-medium text-indigo-600 transition hover:bg-indigo-50">
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                    {doc && doc.fieldValues && doc.fieldValues.length > 0 ? (
                      <div className="mt-2 border-t border-[var(--c-border-light)] pt-2 space-y-1">
                        {doc.fieldValues.map((fv, fi) => (
                          <p key={fi} className="text-xs text-slate-600">
                            <span className="font-medium text-slate-700">{fv.label}:</span> {fv.value}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )
          ) : (
            <p className="text-sm text-slate-400">Unable to load documents.</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={onClose} type="button">Close</ActionButton>
        </div>
    </MemberActionModal>
  );
}
