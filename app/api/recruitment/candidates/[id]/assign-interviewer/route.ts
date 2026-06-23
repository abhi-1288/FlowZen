import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
    if (!user.company) return jsonError("No company found.", 400);

    const { role, roundType, assigneeId } = await request.json();
    if (!role || !roundType) return jsonError("role and roundType are required.", 400);

    const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
    if (!candidate) return jsonError("Candidate not found.", 404);

    let assigneeUser = null;
    if (assigneeId) {
      assigneeUser = await User.findOne({ _id: assigneeId, company: user.company, role });
      if (!assigneeUser) return jsonError("Selected user not found or role mismatch.", 404);
    }
    const assignedTeam = (candidate as any).assignedTeam || [];
    const alreadyAssigned = assignedTeam.find((a: any) => a.role === role);
    if (alreadyAssigned) return jsonError(`${role} already assigned for this candidate.`, 409);

    assignedTeam.push({ role, user: assigneeId || null, roundType, status: "assigned", feedback: "" });
    (candidate as any).assignedTeam = assignedTeam;
    await candidate.save();

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "interview-scheduled",
      metadata: { role, roundType, assignedTo: assigneeUser?.name || "TBD" },
      actor: user._id,
      company: user.company,
    });

    if (assigneeUser) {
      await Notification.create({
        user: assigneeUser._id,
        company: user.company,
        type: "info",
        title: "Interview Assigned",
        body: `You have been assigned as ${role} for ${candidate.firstName} ${candidate.lastName} (${roundType} round).`,
        link: `/recruitment/candidates/${candidate._id}`,
      });
      emitNotification(String(assigneeUser._id));
    }

    const recUsers = await User.find({ company: user.company, role: { $in: ["admin", "human-resource", "project-manager", "qa-tester", "finance"] }, _id: { $ne: userId } });
    for (const ru of recUsers) {
      emitToUser(String(ru._id), "recruitment:update", { type: "interviewer-assigned", candidateId: String(candidate._id) });
    }

    const updated = await ATSCandidate.findById(candidate._id).populate("assignedTeam.user", "name email").populate("job", "title").populate("assignedRecruiter", "name email");
    return NextResponse.json({ candidate: serializeDoc(updated) });
  } catch (err: any) {
    return jsonError(err.message || "Failed to assign interviewer", 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
    if (!user.company) return jsonError("No company found.", 400);

    const { role } = await request.json();
    if (!role) return jsonError("role is required.", 400);

    const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
    if (!candidate) return jsonError("Candidate not found.", 404);

    const assignedTeam = ((candidate as any).assignedTeam || []).filter((a: any) => a.role !== role);
    (candidate as any).assignedTeam = assignedTeam;
    await candidate.save();

    const updated = await ATSCandidate.findById(candidate._id).populate("assignedTeam.user", "name email").populate("job", "title").populate("assignedRecruiter", "name email");

    const recUsers = await User.find({ company: user.company, role: { $in: ["admin", "human-resource", "project-manager", "qa-tester", "finance"] }, _id: { $ne: userId } });
    for (const ru of recUsers) {
      emitToUser(String(ru._id), "recruitment:update", { type: "interviewer-removed", candidateId: String(candidate._id) });
    }

    return NextResponse.json({ candidate: serializeDoc(updated) });
  } catch (err: any) {
    return jsonError(err.message || "Failed to remove assignment", 500);
  }
}
