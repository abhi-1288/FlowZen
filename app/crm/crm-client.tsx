"use client";

import dynamic from "next/dynamic";

export const CrmClient = dynamic(
  () => import("@/components/crm/crm-shell").then((mod) => mod.CrmShell),
  { ssr: false }
);