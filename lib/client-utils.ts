import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { emitErrorToast } from "@/lib/toast-context";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
