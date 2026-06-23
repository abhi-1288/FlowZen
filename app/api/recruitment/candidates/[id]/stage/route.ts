import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
const VALID_STAGES = ["applied", "screening", "technical-interview", "manager-round", "hr-round", "offer", "joined", "rejected"];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  const body = await request.json();
  const toStage = String(body.stage ?? "");
  if (!VALID_STAGES.includes(toStage)) return jsonError("Invalid stage.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company })
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");
  if (!candidate) return jsonError("Candidate not found.", 404);

  const fromStage = candidate.stage;

  candidate.stage = toStage as typeof candidate.stage;
  await candidate.save();

  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: toStage === "joined" ? "joined" : toStage === "rejected" ? "rejected" : "stage-changed",
    metadata: { from: fromStage, to: toStage },
    actor: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "stage-change",
    entityType: "ATSCandidate",
    entityId: candidate._id,
    metadata: { name: `${candidate.firstName} ${candidate.lastName}`, from: fromStage, to: toStage },
    company: user.company,
  });

  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
  const jobTitle = (candidate.job as any)?.title || "a position";

  const hrAndAdmin = await User.find({
    company: user.company,
    role: { $in: ["admin", "human-resource"] },
  });
  for (const u of hrAndAdmin) {
    if (String(u._id) === String(userId)) continue;
    await Notification.create({
      user: u._id,
      company: user.company,
      type: "info",
      title: "Candidate Stage Changed",
      message: `${candidateName} moved from ${fromStage} to ${toStage} for ${jobTitle}.`,
      link: `/recruitment/candidates/${candidate._id}`,
    });
    emitToUser(String(u._id), "notification:new", {
      message: `${candidateName} moved to ${toStage} for ${jobTitle}.`,
    });
    emitToUser(String(u._id), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
  }

  if (toStage === "manager-round") {
    const managers = await User.find({ company: user.company, role: "project-manager" });
    for (const manager of managers) {
      await Notification.create({
        user: manager._id,
        type: "info",
        title: "Manager Round Ready",
        message: `${candidateName} reached Manager Round for ${jobTitle}.`,
      });
      emitToUser(String(manager._id), "notification:new", {
        message: `${candidateName} reached Manager Round.`,
      });
      emitToUser(String(manager._id), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
    }
  }

  const otherRecruitmentRoles = await User.find({ company: user.company, role: { $in: ["project-manager", "qa-tester", "finance"] }, _id: { $ne: userId } });
  for (const u of otherRecruitmentRoles) {
    emitToUser(String(u._id), "recruitment:update", { type: "stage-changed", candidateId: String(candidate._id) });
  }

  const refreshed = await ATSCandidate.findById(candidate._id)
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");

  return NextResponse.json({ candidate: serializeDoc(refreshed!) });
}
