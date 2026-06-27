"use client";

import { usePathname } from "next/navigation";
import { DashboardTab } from "@/components/recruitment/tabs/dashboard";
import { JobsTab } from "@/components/recruitment/tabs/jobs";
import { CandidatesTab } from "@/components/recruitment/tabs/candidates";
import { BoardTab } from "@/components/recruitment/tabs/board";
import { InterviewsTab } from "@/components/recruitment/tabs/interviews";
import { OffersTab } from "@/components/recruitment/tabs/offers";
import { ReferralsTab } from "@/components/recruitment/tabs/referrals";

const TABS = [
  { key: "dashboard", component: DashboardTab },
  { key: "jobs", component: JobsTab },
  { key: "candidates", component: CandidatesTab },
  { key: "board", component: BoardTab },
  { key: "interviews", component: InterviewsTab },
  { key: "offers", component: OffersTab },
  { key: "referrals", component: ReferralsTab },
] as const;

export function RecruitmentHub() {
  const pathname = usePathname() ?? "";
  const currentTab = pathname.replace("/recruitment/", "").replace(/\/$/, "") || "dashboard";

  const tab = TABS.find((t) => t.key === currentTab);
  const Component = tab?.component ?? DashboardTab;

  return <Component />;
}
