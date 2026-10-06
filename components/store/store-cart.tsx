"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Loader2, Minus, Plus, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useStoreCart } from "@/components/store/cart-context";
import { useStoreNav } from "@/components/store/store-nav";

type ApproverOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  teamOwner?: boolean;
};

type ApproverPlan = {
  region: string;
  regionFallback: boolean;
  teamOwner: ApproverOption | null;
  teamOwnerBlockedReason: "" | "none" | "out-of-region";
  approvers: ApproverOption[];
};

export function StoreCart() {
  const nav = useStoreNav();
  const { data: session } = useSession();
  const { lines, setQuantity, remove, clear, ready, count } = useStoreCart();
  const [plan, setPlan] = useState<ApproverPlan | null>(null);
  const [approverId, setApproverId] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDeliveryName((prev) => prev || String(session?.user?.name ?? ""));
  }, [session?.user?.name]);

  useEffect(() => {
    apiFetch<ApproverPlan>("/api/store/approvers", undefined, { toast: false })
      .then((res) => {
        setPlan(res);
        if (res.teamOwner) setApproverId(res.teamOwner.id);
        else if (res.approvers.length > 0) setApproverId(res.approvers[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load approvers."));
  }, []);

  const totals = useMemo(() => {
    const units = lines.reduce((sum, l) => sum + l.quantity, 0);
    const value = lines.reduce((sum, l) => sum + l.quantity * Number(l.price ?? 0), 0);
    return { units, value };
  }, [lines]);

  const blocked = lines.some((l) => l.quantity > l.stock);

  async function submit() {
    setError("");
    if (lines.length === 0) return;
    if (!approverId) return setError("Pick an approver for this order.");
    if (!deliveryName.trim()) return setError("A delivery name is required.");
    if (!department.trim()) return setError("An address (department) is required.");
    setSubmitting(true);
    try {
      await apiFetch("/api/store/orders", {
        method: "POST",
        body: JSON.stringify({
          items: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
          deliveryName: deliveryName.trim(),
          department: department.trim(),
          approverId,
        }),
      });
      clear();
      nav("orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to place the order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid place-items-center py-24 text-slate-400">
        <Loader2 className="animate-spin" size={26} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => nav("catalog")}
          className="neu-btn grid h-10 w-10 place-items-center rounded-full"
          title="Back to store"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Cart</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {count ? `${count} unit(s) · ${lines.length} line(s)` : "Your cart is empty"}
          </p>
        </div>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {lines.length === 0 ? (
        <div className="neu-card grid place-items-center gap-3 rounded-2xl p-12 text-center">
          <ShoppingCart size={30} className="text-slate-300" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">Nothing in the cart yet.</p>
          <button
            onClick={() => nav("catalog")}
            className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-semibold"
          >
            Browse products
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-3">
            {lines.map((line) => (
              <div key={line.itemId} className="neu-card flex flex-wrap items-center gap-3 rounded-2xl p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">{line.name}</p>
                  <p className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                    {line.productNumber}
                    {line.price > 0 ? ` · ₹${Number(line.price).toFixed(2)} / ${line.unit}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="neu-btn grid h-8 w-8 place-items-center rounded-lg"
                    onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={line.stock}
                    value={line.quantity}
                    onChange={(e) => setQuantity(line.itemId, Number(e.target.value))}
                    className="neu-inset w-16 rounded-lg px-2 py-1.5 text-center text-sm"
                  />
                  <button
                    className="neu-btn grid h-8 w-8 place-items-center rounded-lg"
                    onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => remove(line.itemId)}
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {blocked ? (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                A quantity exceeds the current stock. Lower it before placing the order.
              </p>
            ) : null}
          </section>

          <aside className="neu-card h-fit rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Order details
            </h2>

            <Field label="Delivery name">
              <input
                value={deliveryName}
                onChange={(e) => setDeliveryName(e.target.value)}
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Who receives this?"
              />
            </Field>

            <Field label="Address (department)">
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Design · 2nd Floor"
              />
            </Field>

            <Field label="Approver">
              <select
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select an approver…</option>
                {plan?.approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.teamOwner ? "★ " : ""}
                    {a.name} — {a.role}
                    {a.teamOwner ? " (team owner)" : ""}
                  </option>
                ))}
              </select>
            </Field>

            {plan?.teamOwnerBlockedReason === "out-of-region" ? (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Your team owner sits outside your region, so they were left out. Pick another approver.
              </p>
            ) : null}
            {plan?.regionFallback ? (
              <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
                No approver from {plan.region || "your region"} is available — showing the whole company.
              </p>
            ) : null}

            <div className="neu-inset mb-4 space-y-1 rounded-lg px-3 py-2 text-sm">
              <Row label="Units" value={String(totals.units)} />
              <Row label="Item value" value={totals.value > 0 ? `₹${totals.value.toFixed(2)}` : "—"} />
              <p className="pt-1 text-xs text-slate-400">
                No payment is taken — approval simply releases the held stock.
              </p>
            </div>

            <button
              onClick={submit}
              disabled={submitting || blocked || !approverId}
              className="neu-btn neu-btn-primary flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />}
              Place order
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-zinc-400">{label}</span>
      <span className="font-semibold text-slate-700 dark:text-zinc-200">{value}</span>
    </div>
  );
}
