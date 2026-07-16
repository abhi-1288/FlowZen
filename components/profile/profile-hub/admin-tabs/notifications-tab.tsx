import { Bell, Check, ExternalLink, Trash2, X } from "lucide-react";
import { ActionButton, AnyRecord, SectionHeader } from "../shared";

function getNotificationGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekStart = new Date(today.getTime() - today.getDay() * 86400000);
  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekStart) return "This Week";
  return "Earlier";
}

export function NotificationsTab({
  notifications,
  markAllRead,
  deleteAll,
  markRead,
  deleteOne,
  page,
  totalPages,
  fromDate,
  toDate,
  onPageChange,
  onDateFilterChange,
}: {
  notifications: AnyRecord[];
  markAllRead: () => Promise<void>;
  deleteAll: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  page: number;
  totalPages: number;
  fromDate: string;
  toDate: string;
  onPageChange: (page: number) => void;
  onDateFilterChange: (from: string, to: string) => void;
}) {
  const grouped = notifications.reduce<Record<string, AnyRecord[]>>((acc, item) => {
    const group = getNotificationGroup(item.createdAt ? new Date(String(item.createdAt)) : new Date());
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader title="Notifications" description="Join requests, project updates, and deadline notices." accent="violet" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" className="rounded-md border border-slate-200 px-2 py-1 text-[11px]" value={fromDate} onChange={(e) => onDateFilterChange(e.target.value, toDate)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" className="rounded-md border border-slate-200 px-2 py-1 text-[11px]" value={toDate} onChange={(e) => onDateFilterChange(fromDate, e.target.value)} />
        </div>
        {(fromDate || toDate) ? (
          <ActionButton variant="secondary" className="px-3 text-xs" onClick={() => onDateFilterChange("", "")}><X size={14} /> Clear</ActionButton>
        ) : null}
        <div className="ml-auto flex gap-2">
          <ActionButton variant="secondary" className="px-3" onClick={markAllRead}><Check size={16} /> Mark all read</ActionButton>
          <ActionButton variant="danger" className="px-3" onClick={deleteAll}><Trash2 size={16} /> Delete all</ActionButton>
        </div>
      </div>
      <div className="space-y-5">
        {notifications.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No notifications yet.</p>
        ) : (
          groupOrder.map((group) => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div className={`rounded-xl border p-4 hover:shadow-sm ${item.readAt ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-white shadow-sm hover:shadow-md"}`} key={String(item.id)}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Bell size={18} /></div>
                          <div>
                            <p className="font-medium">{String(item.title ?? "Notification")}</p>
                            <p className="text-sm">{String(item.body || item.message || "")}</p>
                            <p className="mt-1 text-xs text-slate-400">{item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : ""}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 sm:flex-col">
                          {item.link ? (
                            <a href={String(item.link)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100" target="_blank" rel="noopener noreferrer">
                              <ExternalLink size={14} /> View
                            </a>
                          ) : null}
                          {!item.readAt ? (
                            <ActionButton aria-label="Mark notification as read" variant="secondary" onClick={() => markRead(String(item.id))} title="Mark as read" type="button"><Check size={17} /></ActionButton>
                          ) : null}
                          {!item.readAt ? (
                            <ActionButton aria-label="Delete notification" variant="danger" onClick={() => deleteOne(String(item.id))} title="Delete" type="button"><Trash2 size={17} /></ActionButton>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <ActionButton variant="secondary" className="px-3" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</ActionButton>
            <ActionButton variant="secondary" className="px-3" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</ActionButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
