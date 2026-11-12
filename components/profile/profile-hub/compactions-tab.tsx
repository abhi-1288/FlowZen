"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompactionsPanel } from "@/components/continuity/compactions-panel";
import { TeamCompactionsPanel } from "@/components/continuity/team-compactions-panel";
import { Card, PanelHeader } from "@/components/continuity/common";

/**
 * The profile catch-all route only reads the first path segment, so
 * `/profile/team-compactions/<id>` still renders this tab. The id has to come
 * from the browser URL rather than a route param.
 */
export function usePathSegment(prefix: string): string {
  const [segment, setSegment] = useState("");
  useEffect(() => {
    const read = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const index = parts.indexOf(prefix);
      setSegment(index >= 0 ? parts[index + 1] ?? "" : "");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [prefix]);
  return segment;
}

export function CompactionsTab() {
  const searchParams = useSearchParams();
  const focusId = searchParams?.get("focus") ?? "";
  const scope = searchParams?.get("scope") === "received" ? "received" : "mine";
  return <CompactionsPanel defaultScope={scope} focusId={focusId} />;
}

export function TeamCompactionsTab() {
  const compactionId = usePathSegment("team-compactions");
  return (
    <div className="space-y-3">
      {compactionId ? (
        <Card className="border-l-4 border-l-indigo-400">
          <PanelHeader
            title="Team compaction review"
            description="Review the consolidation, include or exclude source reports, and confirm before it reaches the admin team."
          />
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Opened compaction <span className="font-mono text-slate-700 dark:text-zinc-300">{compactionId}</span>.
          </p>
        </Card>
      ) : null}
      <TeamCompactionsPanel defaultScope="owned" focusId={compactionId} />
    </div>
  );
}

export function ReceivedTeamCompactionsTab() {
  const compactionId = usePathSegment("received-team-compactions");
  return (
    <div className="space-y-4">
      <Card>
        <PanelHeader
          title="Received employee reports"
          description="Employee EOD/EOW compactions delivered directly to Admin when no Team Owner is assigned."
        />
        <CompactionsPanel defaultScope="received" />
      </Card>
      <TeamCompactionsPanel defaultScope="received" focusId={compactionId} />
    </div>
  );
}
