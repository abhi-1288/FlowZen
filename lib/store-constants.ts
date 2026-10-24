/**
 * Store constants shared by server routes and client components.
 * Kept free of model/DB imports so pages can import it directly.
 */

export const STORE_MANAGE_ROLES = ["warehouse"] as const;

/**
 * Roles eligible to approve a store order. Team owners are added on top of
 * this list even when their own role is outside it — owning the requester's
 * team is itself the qualification.
 */
export const STORE_APPROVER_ROLES = [
  "admin",
  "human-resource",
  "finance",
  "project-manager",
  "qa-tester",
  "it-admin",
] as const;

export const STORE_CATEGORIES = [
  "stationery",
  "paper",
  "books",
  "letterhead",
  "electronics",
  "accessories",
  "office-supplies",
  "other",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  stationery: "Stationery",
  paper: "Paper",
  books: "Books",
  letterhead: "Letterhead",
  electronics: "Electronics",
  accessories: "Accessories",
  "office-supplies": "Office Supplies",
  other: "Other",
};

export type StoreOrderStatus = "pending" | "approved" | "fulfilled" | "rejected" | "cancelled";

export const STORE_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STORE_STATUS_COLORS: Record<StoreOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  fulfilled: "bg-indigo-50 text-indigo-700",
  rejected: "bg-rose-50 text-rose-600",
  cancelled: "bg-zinc-100 text-zinc-500",
};

export const STORE_TRANSITION_ACTIONS: Record<StoreOrderStatus, StoreOrderStatus[]> = {
  pending: ["approved", "rejected", "cancelled"],
  // Fulfilment is no longer a manual transition: the warehouse completes a
  // delivery (all lines delivered) or a take-away (handed over) instead.
  approved: [],
  fulfilled: [],
  rejected: [],
  cancelled: [],
};

export const STORE_FULFILLMENT_METHODS = ["delivery", "takeaway"] as const;

export type StoreFulfillmentMethod = (typeof STORE_FULFILLMENT_METHODS)[number];

export const STORE_FULFILLMENT_METHOD_LABELS: Record<StoreFulfillmentMethod, string> = {
  delivery: "Delivery",
  takeaway: "Take-away",
};

export function isStoreFulfillmentMethod(value: unknown): value is StoreFulfillmentMethod {
  return (STORE_FULFILLMENT_METHODS as readonly string[]).includes(String(value ?? ""));
}

export function fulfillmentMethodLabel(value: unknown): string {
  const key = String(value ?? "delivery") as StoreFulfillmentMethod;
  return STORE_FULFILLMENT_METHOD_LABELS[key] ?? key;
}

export const STORE_TAKEAWAY_STATUSES = ["pending", "ready", "handed-over"] as const;

export type StoreTakeAwayStatus = (typeof STORE_TAKEAWAY_STATUSES)[number];

export const STORE_TAKEAWAY_STATUS_LABELS: Record<StoreTakeAwayStatus, string> = {
  pending: "Not packed",
  ready: "Ready for pickup",
  "handed-over": "Handed over",
};

export const STORE_TAKEAWAY_STATUS_COLORS: Record<StoreTakeAwayStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  ready: "bg-sky-50 text-sky-700",
  "handed-over": "bg-emerald-50 text-emerald-700",
};

export function takeAwayStatusLabel(value: unknown): string {
  const key = String(value ?? "pending") as StoreTakeAwayStatus;
  return STORE_TAKEAWAY_STATUS_LABELS[key] ?? key;
}

export function takeAwayStatusColor(value: unknown): string {
  const key = String(value ?? "pending") as StoreTakeAwayStatus;
  return STORE_TAKEAWAY_STATUS_COLORS[key] ?? "bg-zinc-100 text-zinc-500";
}

/**
 * Per-product delivery progress, set by the warehouse on an approved order.
 * `pending` is the state every line lands in when the order is approved —
 * the warehouse then moves each product through the three real stages.
 */
export const STORE_DELIVERY_STATUSES = [
  "pending",
  "packing",
  "out-for-delivery",
  "delivered",
] as const;

export type StoreDeliveryStatus = (typeof STORE_DELIVERY_STATUSES)[number];

/** Stages the warehouse is allowed to set on a line (not `pending`). */
export const STORE_SETTABLE_DELIVERY_STATUSES = [
  "packing",
  "out-for-delivery",
  "delivered",
] as const;

export const STORE_DELIVERY_STATUS_LABELS: Record<StoreDeliveryStatus, string> = {
  pending: "Awaiting packing",
  packing: "Packing",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
};

export const STORE_DELIVERY_STATUS_COLORS: Record<StoreDeliveryStatus, string> = {
  pending: "bg-zinc-100 text-zinc-500",
  packing: "bg-amber-50 text-amber-700",
  "out-for-delivery": "bg-sky-50 text-sky-700",
  delivered: "bg-emerald-50 text-emerald-700",
};

export function isStoreDeliveryStatus(value: unknown): value is StoreDeliveryStatus {
  return (STORE_DELIVERY_STATUSES as readonly string[]).includes(String(value ?? ""));
}

export function isSettableDeliveryStatus(value: unknown): value is StoreDeliveryStatus {
  return (STORE_SETTABLE_DELIVERY_STATUSES as readonly string[]).includes(String(value ?? ""));
}

export function deliveryStatusLabel(value: unknown): string {
  const key = String(value ?? "pending") as StoreDeliveryStatus;
  return STORE_DELIVERY_STATUS_LABELS[key] ?? key;
}

export function deliveryStatusColor(value: unknown): string {
  const key = String(value ?? "pending") as StoreDeliveryStatus;
  return STORE_DELIVERY_STATUS_COLORS[key] ?? "bg-zinc-100 text-zinc-500";
}

export function canTransitionStoreOrder(from: unknown, to: unknown): boolean {
  const fromKey = String(from ?? "") as StoreOrderStatus;
  const toKey = String(to ?? "") as StoreOrderStatus;
  if (fromKey === toKey) return true;
  return (STORE_TRANSITION_ACTIONS[fromKey] ?? []).includes(toKey);
}

export function isStoreManager(role: unknown): boolean {
  return (STORE_MANAGE_ROLES as readonly string[]).includes(String(role ?? ""));
}

export function isStoreApproverRole(role: unknown): boolean {
  return (STORE_APPROVER_ROLES as readonly string[]).includes(String(role ?? ""));
}

export function statusLabel(status: unknown): string {
  const key = String(status ?? "") as StoreOrderStatus;
  return STORE_STATUS_LABELS[key] ?? key;
}

export function statusColor(status: unknown): string {
  const key = String(status ?? "") as StoreOrderStatus;
  return STORE_STATUS_COLORS[key] ?? "bg-zinc-100 text-zinc-500";
}

export function categoryLabel(value: unknown): string {
  const key = String(value ?? "") as StoreCategory;
  return STORE_CATEGORY_LABELS[key] ?? key;
}
