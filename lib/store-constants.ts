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
  approved: ["fulfilled"],
  fulfilled: [],
  rejected: [],
  cancelled: [],
};

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
