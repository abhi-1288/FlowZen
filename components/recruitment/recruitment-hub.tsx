"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { DashboardTab } from "@/components/recruitment/tabs/dashboard";
import { JobsTab } from "@/components/recruitment/tabs/jobs";
import { CandidatesTab } from "@/components/recruitment/tabs/candidates";
import { BoardTab } from "@/components/recruitment/tabs/board";
import { InterviewsTab } from "@/components/recruitment/tabs/interviews";
import { OffersTab } from "@/components/recruitment/tabs/offers";
import { ReferralsTab } from "@/components/recruitment/tabs/referrals";
import { useRecruitmentStore } from "@/store/recruitment-store";

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
  const params = useParams<{ tab?: string[] }>();
  const currentTab = params?.tab?.[0] ?? "dashboard";
  const setModal = useRecruitmentStore((s) => s.setModal);

  useEffect(() => {
    setModal(null);
  }, [currentTab, setModal]);

  const tab = TABS.find((t) => t.key === currentTab);
  const Component = tab?.component ?? DashboardTab;

  return <Component key={currentTab} />;
}
