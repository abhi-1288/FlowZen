import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { JoinRequest } from "@/models/JoinRequest";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSOffer } from "@/models/ATSOffer";
import { isObjectId, jsonError, requireUserId, serializeDocs, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const ALL_ROLES = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid request id.");

  await connectDb();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any)?.isSeniorSecurity);
  if (!user || (!ALL_ROLES.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const joinRequest = await JoinRequest.findOne({ _id: id, company: user.company, kind: "company" });
  if (!joinRequest) return jsonError("Onboarding request not found.", 404);

  const meta = (joinRequest.metadata ?? {}) as Record<string, unknown>;
  const candidateId = String(meta.convertedFromCandidate ?? "");
  if (!candidateId || !isObjectId(candidateId)) {
    return NextResponse.json({ job: null, candidate: null, interviews: [], offer: null });
  }

  const [candidate, interviews, offer] = await Promise.all([
    ATSCandidate.findOne({ _id: candidateId, company: user.company })
      .populate("assignedRecruiter", "name email")
      .populate("job"),
    ATSInterview.find({ candidate: candidateId, company: user.company })
      .sort({ scheduledAt: -1 })
      .populate("interviewer", "name email")
      .populate("job", "title department"),
    ATSOffer.findOne({ candidate: candidateId, company: user.company })
      .sort({ createdAt: -1 }),
  ]);

  const jobDoc = candidate && candidate.job ? candidate.job : null;
  const rawCandidate = candidate ? serializeDoc(candidate) : null;

  return NextResponse.json({
    job: jobDoc ? serializeDoc(jobDoc as any) : null,
    candidate: rawCandidate,
    interviews: serializeDocs(interviews),
    offer: offer ? serializeDoc(offer) : null,
  });
}
