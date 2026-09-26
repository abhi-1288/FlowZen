import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { canStartInterview } from "@/lib/interview-utils";
import { isInterviewJoinWindowOpen, isInterviewJoinable } from "@/lib/interview-timing";
import { isFlowZenVideoInterview, videoProviderLabel } from "@/lib/interview-provider";
import { getSignalingProvider, SIGNALING_CONCURRENCY_LIMITS } from "@/lib/signaling";
import { ICE_SERVERS } from "@/lib/webrtc-config";
import { ATSInterview } from "@/models/ATSInterview";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

/**
 * Issues the signalling room for a FlowZen-hosted interview. Authorization is
 * identical to the previous room-token endpoint: a candidate proves ownership
 * with the invitation token, an interviewer must hold an active session and be
 * the assigned interviewer.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid interview id.");

  const body = await request.json().catch(() => ({}));
  const candidateAccess = String(body?.access ?? "").trim();

  let participant: { id: string; name: string; role: "candidate" | "interviewer" };
  let peerName: string;
  let interview: any;

  await connectDb();

  if (candidateAccess) {
    const tokenHash = createHash("sha256").update(candidateAccess).digest("hex");
    interview = await ATSInterview.findOne({
      _id: id,
      videoRoomTokenHash: tokenHash,
      videoRoomTokenExpiresAt: { $gt: new Date() },
    })
      .select("+videoRoomTokenHash +videoRoomTokenExpiresAt")
      .populate("candidate", "firstName lastName")
      .populate("interviewer", "name");

    if (!interview) return jsonError("This interview invitation is invalid or has expired.", 404);
    const candidate = interview.candidate;
    participant = {
      id: String(candidate?._id ?? interview.candidate),
      name: `${candidate?.firstName ?? ""} ${candidate?.lastName ?? ""}`.trim() || "Candidate",
      role: "candidate",
    };
    peerName = interview.interviewer?.name || "Interviewer";
  } else {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    const user = await User.findById(userId);
    if (!user?.company) return jsonError("Forbidden", 403);

    interview = await ATSInterview.findOne({ _id: id, company: user.company })
      .select("+videoRoomTokenHash +videoRoomTokenExpiresAt")
      .populate("candidate", "firstName lastName")
      .populate("interviewer", "name");

    if (!interview) return jsonError("Interview not found.", 404);
    const interviewerId = String(interview.interviewer?._id ?? interview.interviewer);
    if (interviewerId !== userId) {
      return jsonError("Only the assigned interviewer can join this call.", 403);
    }
    participant = {
      id: userId,
      name: interview.interviewer?.name || user.name || "Interviewer",
      role: "interviewer",
    };
    peerName =
      `${interview.candidate?.firstName ?? ""} ${interview.candidate?.lastName ?? ""}`.trim() ||
      "Candidate";
  }

  if (!isInterviewJoinable(interview.status)) {
    return jsonError("This interview is no longer available for joining.", 409);
  }
  if (interview.meetingType !== "video" || String(interview.location ?? "").trim()) {
    return jsonError("This interview does not have a video room.", 400);
  }
  if (!isFlowZenVideoInterview(interview)) {
    return jsonError(
      `This interview is hosted on ${videoProviderLabel(interview.videoProvider)}. Open the meeting link instead.`,
      400
    );
  }
  if (!isInterviewJoinWindowOpen(interview.scheduledAt)) {
    return jsonError("The call opens five minutes before the scheduled interview time.", 425);
  }

  if (interview.status !== "in-progress") {
    const canStart = await canStartInterview(id, String(interview.company));
    if (!canStart.ok) return jsonError(canStart.reason, 409);

    const started = await ATSInterview.updateOne(
      { _id: id, status: { $in: ["scheduled", "rescheduled"] } },
      { $set: { status: "in-progress" } }
    );
    if (started.modifiedCount !== 1) {
      const current = await ATSInterview.findById(id).select("status").lean();
      if (current?.status !== "in-progress") return jsonError("The interview could not be started.", 409);
    }
  }

  const provider = getSignalingProvider();

  return NextResponse.json(
    {
      // The token hash doubles as the room id. It is a 64-character secret that
      // only ever appears inside invitation links, so it works as a capability
      // token without a second access-control system.
      roomId: String(interview.videoRoomTokenHash),
      role: participant.role,
      displayName: participant.name,
      peerName,
      signaling: provider,
      concurrencyLimit: SIGNALING_CONCURRENCY_LIMITS[provider],
      iceServers: ICE_SERVERS,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
