"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { setActiveDelegationId } from "@/lib/client-utils";

/**
 * Keeps the module-level active delegation in sync with the URL on pages that
 * are not wrapped by `ProfileHub` (e.g. `/board`, `/recruitment`). Without this,
 * `apiFetch` would not attach `X-Delegation-Id` and every delegated request
 * would be rejected.
 */
export function DelegationSync() {
  const searchParams = useSearchParams();
  const delegationId = searchParams?.get("delegation") ?? "";
  useEffect(() => {
    setActiveDelegationId(delegationId);
    return () => setActiveDelegationId("");
  }, [delegationId]);
  return null;
}
