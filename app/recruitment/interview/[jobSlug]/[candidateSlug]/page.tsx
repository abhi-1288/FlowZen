import type { Metadata, Viewport } from "next";
import { InterviewDetailPage } from "@/components/recruitment/interview-room/interview-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interview | FlowZen",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

type PageProps = {
  params: Promise<{ jobSlug: string; candidateSlug: string }>;
  searchParams: Promise<{ interview?: string | string[]; access?: string | string[] }>;
};

export default async function InterviewRoomPage({ params, searchParams }: PageProps) {
  const [{ jobSlug, candidateSlug }, query] = await Promise.all([params, searchParams]);
  const interview = Array.isArray(query.interview) ? query.interview[0] : query.interview;
  const access = Array.isArray(query.access) ? query.access[0] : query.access;

  return (
    <InterviewDetailPage
      jobSlug={jobSlug}
      candidateSlug={candidateSlug}
      interviewId={interview}
      access={access}
    />
  );
}
