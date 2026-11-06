"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Store as StoreIcon,
  Trash2,
  Truck,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { useStoreCart } from "@/components/store/cart-context";
import { useStoreNav } from "@/components/store/store-nav";
import {
  StoreAlert,
  StoreCategoryIcon,
  StoreEmpty,
  StoreShell,
} from "@/components/store/store-shell";

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
  const { showSuccessToast } = useNotificationToast();
  const [plan, setPlan] = useState<ApproverPlan | null>(null);
  const [approverId, setApproverId] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [department, setDepartment] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"delivery" | "takeaway">("delivery");
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

  function updateQuantity(itemId: string, raw: string, max: number) {
    const next = Math.floor(Number(raw));
    if (!Number.isFinite(next)) return;
    setQuantity(itemId, Math.min(Math.max(next, 1), max));
  }

  async function submit() {
    setError("");
    if (lines.length === 0) return;
    if (!approverId) return setError("Pick an approver for this order.");
    if (!deliveryName.trim()) {
      return setError(
        fulfillmentMethod === "takeaway" ? "A pickup person is required." : "A delivery name is required.",
      );
    }
    if (fulfillmentMethod === "delivery" && !department.trim()) {
      return setError("An address (department) is required.");
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/store/orders", {
        method: "POST",
        body: JSON.stringify({
          items: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
          deliveryName: deliveryName.trim(),
          department: department.trim(),
          fulfillmentMethod,
          approverId,
        }),
      });
      const units = totals.units;
      clear();
      nav("orders");
      showSuccessToast(
        `Order placed — ${units} unit${units === 1 ? "" : "s"} awaiting approval`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to place the order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <StoreShell view="cart" title="Cart">
        <div className="grid place-items-center py-24 text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      </StoreShell>
    );
  }

  return (
    <StoreShell
      view="cart"
      title="Cart"
      subtitle={
        count ? `${count} unit${count === 1 ? "" : "s"} · ${lines.length} line${lines.length === 1 ? "" : "s"}` : "Your cart is empty"
      }
    >
      {error ? <StoreAlert>{error}</StoreAlert> : null}

      {lines.length === 0 ? (
        <StoreEmpty
          icon={ShoppingCart}
          title="Nothing in the cart"
          message="Browse the store and add products — they'll stay in the cart even between visits."
        >
          <button
            onClick={() => nav("catalog")}
            className="neu-btn neu-btn-primary rounded-full px-4 py-2 text-sm font-semibold"
          >
            Browse products
          </button>
        </StoreEmpty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="space-y-3">
            {lines.map((line) => {
              const overStock = line.quantity > line.stock;
              const lineTotal = line.quantity * Number(line.price ?? 0);
              return (
                <div
                  key={line.itemId}
                  className={`neu-card flex flex-wrap items-center gap-3 rounded-2xl p-4 ${
                    overStock ? "outline outline-2 -outline-offset-2 outline-amber-300 dark:outline-amber-700" : ""
                  }`}
                >
                  <StoreCategoryIcon category={String(line.category ?? "")} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">
                      {line.name}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                      {line.productNumber}
                      {line.price > 0 ? ` · ₹${Number(line.price).toFixed(2)} / ${line.unit}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="neu-btn grid h-8 w-8 place-items-center rounded-lg"
                      onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                      title="One less"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={line.stock}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.itemId, e.target.value, line.stock)}
                      className="neu-inset w-14 rounded-lg px-2 py-1.5 text-center text-sm"
                    />
                    <button
                      className="neu-btn grid h-8 w-8 place-items-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                      disabled={line.quantity >= line.stock}
                      title="One more"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-700 dark:text-zinc-200">
                    {lineTotal > 0 ? `₹${lineTotal.toFixed(2)}` : "—"}
                  </span>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    onClick={() => remove(line.itemId)}
                    title={`Remove ${line.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            {blocked ? (
              <StoreAlert tone="amber">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                A quantity exceeds the current stock. Lower it before placing the order.
              </StoreAlert>
            ) : null}
            <button
              onClick={() => nav("catalog")}
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              + Add more products
            </button>
          </section>

          <aside className="neu-card h-fit rounded-2xl p-5 lg:sticky lg:top-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Order details
            </h2>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <FulfillmentCard
                selected={fulfillmentMethod === "delivery"}
                icon={<Truck size={16} />}
                title="Delivery"
                hint="Send to my desk"
                onClick={() => setFulfillmentMethod("delivery")}
              />
              <FulfillmentCard
                selected={fulfillmentMethod === "takeaway"}
                icon={<StoreIcon size={16} />}
                title="Take-away"
                hint="I will collect it"
                onClick={() => setFulfillmentMethod("takeaway")}
              />
            </div>

            <Field label={fulfillmentMethod === "takeaway" ? "Pickup person" : "Delivery name"}>
              <input
                value={deliveryName}
                onChange={(e) => setDeliveryName(e.target.value)}
                className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                placeholder={
                  fulfillmentMethod === "takeaway" ? "Who will collect this?" : "Who receives this?"
                }
              />
            </Field>

            {fulfillmentMethod === "delivery" ? (
              <Field label="Address (department)">
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Design · 2nd Floor"
                />
              </Field>
            ) : (
              <>
                <StoreAlert tone="amber">
                  Collect from the {plan?.region || "company"} warehouse once the warehouse marks it
                  packed and ready.
                </StoreAlert>
                <Field label="Pickup note (optional)">
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="neu-inset w-full rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Collecting after lunch"
                  />
                </Field>
              </>
            )}

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
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Your team owner sits outside your region, so they were left out. Pick another approver.
              </p>
            ) : null}
            {plan?.regionFallback ? (
              <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                No approver from {plan.region || "your region"} is available — showing the whole company.
              </p>
            ) : null}

            <div className="neu-inset mb-4 space-y-1.5 rounded-lg px-3 py-2.5 text-sm">
              <Row label="Units" value={String(totals.units)} />
              <Row label="Lines" value={String(lines.length)} />
              <Row label="Item value" value={totals.value > 0 ? `₹${totals.value.toFixed(2)}` : "—"} />
              <p className="pt-1 text-[11px] leading-snug text-slate-400 dark:text-zinc-500">
                No payment is taken — approval simply releases the held stock.
              </p>
            </div>

            <button
              onClick={submit}
              disabled={submitting || blocked || !approverId}
              className="neu-btn neu-btn-primary flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Place order
            </button>
          </aside>
        </div>
      )}
    </StoreShell>
  );
}

function FulfillmentCard({
  selected,
  icon,
  title,
  hint,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      }`}
    >
      {selected ? (
        <Check size={13} className="absolute right-2 top-2 text-indigo-600 dark:text-indigo-300" />
      ) : null}
      {icon}
      <span className="text-xs font-semibold">{title}</span>
      <span className="text-[10px] opacity-70">{hint}</span>
    </button>
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
