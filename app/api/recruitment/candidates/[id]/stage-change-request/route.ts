import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };
const NON_HR_ROLES = ["project-manager", "qa-tester", "finance"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    await connectDb();
    const user = await User.findById(userId);
    if (!user || !NON_HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
    if (!user.company) return jsonError("No company found.", 400);

    const { feedback } = await request.json();
    if (!feedback || !["suitable", "not-suitable", "on-hold"].includes(feedback)) {
      return jsonError("Feedback must be suitable, not-suitable, or on-hold.", 400);
    }

    const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
    if (!candidate) return jsonError("Candidate not found.", 404);

    const assignedTeam = (candidate as any).assignedTeam || [];
    const myAssignment = assignedTeam.find(
      (a: any) => String(a.user) === String(user._id) && a.status !== "completed"
    );
    if (!myAssignment) return jsonError("You are not assigned to this candidate or already completed.", 403);

    myAssignment.status = "completed";
    myAssignment.feedback = feedback;
    (candidate as any).assignedTeam = assignedTeam;
    (candidate as any).stageChangeRequest = {
      requestedStage: "",
      requestedBy: user._id,
      feedback,
      status: "pending",
    };
    await candidate.save();

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "interview-completed",
      metadata: { role: myAssignment.role, roundType: myAssignment.roundType, feedback },
      actor: user._id,
      company: user.company,
    });

    const hrUsers = await User.find({ company: user.company, role: { $in: ["admin", "human-resource"] } });
    for (const hr of hrUsers) {
      await Notification.create({
        user: hr._id,
        company: user.company,
        type: "info",
        title: "Interview Completed",
        body: `${user.name} completed ${myAssignment.roundType} round for ${candidate.firstName} ${candidate.lastName}. Feedback: ${feedback}. Review and update stage.`,
        link: `/recruitment/candidates/${candidate._id}`,
      });
      emitNotification(String(hr._id));
    }

    const updated = await ATSCandidate.findById(candidate._id).populate("assignedTeam.user", "name email").populate("job", "title").populate("assignedRecruiter", "name email");
    return NextResponse.json({ candidate: serializeDoc(updated) });
  } catch (err: any) {
    return jsonError(err.message || "Failed to submit stage change request", 500);
  }
}
