import { NextResponse } from "next/server";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { serializeDocs } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "read");
  if (!access.ok) return access.response;
  const { user } = access;

  const timeline = await ATSTimeline.find({ candidate: id, company: user.company })
    .sort({ createdAt: -1 })
    .populate("actor", "name");

  const interviewerIds = [
    ...new Set(
      timeline
        .filter((t: any) => t.metadata?.interviewerId)
        .map((t: any) => String(t.metadata.interviewerId))
    ),
  ];
  const interviewerUsers = interviewerIds.length
    ? await User.find({ _id: { $in: interviewerIds } }).select("name companyIdentityCode")
    : [];
  const interviewerMap = new Map(interviewerUsers.map((u: any) => [String(u._id), u]));

  const fmtScheduled = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  for (const t of timeline as any[]) {
    if (t.metadata?.interviewerId) {
      const u = interviewerMap.get(String(t.metadata.interviewerId));
      t.metadata.interviewer = u
        ? [u.name, u.companyIdentityCode].filter(Boolean).join(" · ")
        : "Unknown interviewer";
      delete t.metadata.interviewerId;
    }
    if (t.metadata?.scheduledAt) {
      t.metadata.scheduledAt = fmtScheduled(String(t.metadata.scheduledAt));
    }
  }

  return NextResponse.json({ timeline: serializeDocs(timeline) });
}
