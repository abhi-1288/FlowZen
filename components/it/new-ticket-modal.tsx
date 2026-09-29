"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import {
  type ItTicketCategory,
  type ItTicketPriority,
  IT_CATEGORY_LABELS,
  IT_PRIORITY_LABELS,
  ALL_PROCUREMENT_CATEGORIES,
  PROCUREMENT_CATEGORY_LABELS,
  type ProcurementCategory,
} from "./it-types";

const ALL_CATEGORIES: ItTicketCategory[] = [
  "ACCOUNT_LOGIN",
  "ACCESS_PERMISSION",
  "HARDWARE",
  "SOFTWARE",
  "NETWORK",
  "EMAIL",
  "PRINTER_PERIPHERAL",
  "SECURITY",
  "ACCOUNT_CREATION",
  "OTHER",
];

const ALL_PRIORITIES: ItTicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function NewTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"support" | "purchase">("support");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ItTicketCategory>("OTHER");
  const [priority, setPriority] = useState<ItTicketPriority>("MEDIUM");
  const [department, setDepartment] = useState("");
  const [purchaseCategory, setPurchaseCategory] = useState<ProcurementCategory>("laptop");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [assignedTo, setAssignedTo] = useState("");
  const [assigneeOptions, setAssigneeOptions] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "purchase") return;
    let cancelled = false;
    apiFetch<{ assignees: { id: string; name: string }[] }>("/api/procurement/assignees")
      .then((res) => {
        if (!cancelled) setAssigneeOptions(res.assignees);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      if (mode === "purchase") {
        await apiFetch("/api/procurement", {
          method: "POST",
          body: JSON.stringify({
            title,
            description,
            category: purchaseCategory,
            vendor: vendor.trim(),
            amount: Number(amount),
            quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
            assignedTo: assignedTo || undefined,
          }),
        });
      } else {
        await apiFetch("/api/it/tickets", {
          method: "POST",
          body: JSON.stringify({ title, description, category, priority, department }),
        });
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-[#111]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            {mode === "support" ? "Create New Ticket" : "Request a Purchase"}
          </h3>
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-5 pt-3 dark:border-zinc-700">
          {(["support", "purchase"] as const).map((m) => (
            <button
              key={m}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "border-b-2 border-slate-950 text-slate-950 dark:border-zinc-100 dark:text-zinc-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
              onClick={() => setMode(m)}
              type="button"
            >
              {m === "support" ? "Support ticket" : "Purchase request"}
            </button>
          ))}
        </div>

        <form className="px-5 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {mode === "support" ? (
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                placeholder="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            ) : (
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                value={purchaseCategory}
                onChange={(e) => setPurchaseCategory(e.target.value as ProcurementCategory)}
              >
                {ALL_PROCUREMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PROCUREMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <textarea
            className="mt-3 min-h-24 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            placeholder={mode === "support" ? "Describe the issue..." : "What do you need and why?"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          {mode === "purchase" ? (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  placeholder="Quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  placeholder="Vendor (optional)"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </div>
              <select
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
              >
                <option value="">
                  {assigneeOptions.length === 0
                    ? "No reviewer available in your region"
                    : "Assign a reviewer"}
                </option>
                {assigneeOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                value={category}
                onChange={(e) => setCategory(e.target.value as ItTicketCategory)}
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {IT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ItTicketPriority)}
              >
                {ALL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {IT_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              disabled={
                submitting ||
                !title.trim() ||
                !description.trim() ||
                (mode === "purchase" && !assignedTo)
              }
              type="submit"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {mode === "support" ? "Create" : "Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
