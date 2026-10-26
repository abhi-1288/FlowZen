import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { emitErrorToast } from "@/lib/toast-context";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The delegation the user is currently working inside, if any.
 *
 * It is held in module state (rather than React context) because `apiFetch` is
 * called from plain helpers and non-component code. Every API call made while a
 * shared feature is open automatically carries the delegation id, so feature
 * components never have to thread it through their own request URLs.
 */
let activeDelegationId = "";

export function setActiveDelegationId(id: string | null | undefined) {
  activeDelegationId = String(id ?? "").trim();
}

export function getActiveDelegationId() {
  return activeDelegationId;
}

/** Appends `delegation=<id>` to a URL, or returns it unchanged. */
export function withDelegation(url: string): string {
  if (!activeDelegationId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}delegation=${encodeURIComponent(activeDelegationId)}`;
}

/** Query-string fragment for `fetch` calls that cannot use the header helper. */
export function activeDelegationQuery(): string {
  return activeDelegationId ? `delegation=${encodeURIComponent(activeDelegationId)}` : "";
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { toast?: boolean },
): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      cache: "no-store",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(activeDelegationId ? { "X-Delegation-Id": activeDelegationId } : {}),
        ...init?.headers,
      },
    });
  } catch {
    const message = "Network error. Please check your connection.";
    if (opts?.toast !== false) emitErrorToast(message);
    throw new Error(message);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload && payload.error) || "Something went wrong.";
    if (opts?.toast !== false) emitErrorToast(message);
    throw new Error(message);
  }

  return payload as T;
}
