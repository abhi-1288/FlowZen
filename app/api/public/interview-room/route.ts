import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { interviewSlug } from "@/lib/interview-slug";
import { isExternalVideoProvider, normalizeVideoProvider, videoProviderLabel } from "@/lib/interview-provider";
import { ATSInterview } from "@/models/ATSInterview";

export const dynamic = "force-dynamic";

type PlainRecord = Record<string, unknown>;

function asRecord(value: unknown): PlainRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as PlainRecord
    : null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const access = asString(searchParams.get("access")).trim();
  const job = asString(searchParams.get("job")).trim();
  const candidate = asString(searchParams.get("candidate")).trim();
  if (!access || !job || !candidate) return jsonError("A valid interview invitation is required.", 401);

  await connectDb();
  const interview = await ATSInterview.findOne({
    videoRoomTokenHash: createHash("sha256").update(access).digest("hex"),
    videoRoomTokenExpiresAt: { $gt: new Date() },
    status: { $in: ["scheduled", "rescheduled", "in-progress", "completed", "cancelled"] },
  })
    .select("candidate job interviewer roundType scheduledAt meetingType location status videoProvider meetingLink meetingPassword")
    .populate("candidate", "firstName lastName")
    .populate("job", "title requiredSkills description")
    .populate("interviewer", "name")
    .lean();

  if (!interview) return jsonError("This interview invitation is invalid or has expired.", 404);
  const candidateRecord = asRecord(interview.candidate);
  const jobRecord = asRecord(interview.job);
  const interviewerRecord = asRecord(interview.interviewer);
  const candidateName = `${asString(candidateRecord?.firstName)} ${asString(candidateRecord?.lastName)}`.trim();
  const jobTitle = asString(jobRecord?.title);
  if (interviewSlug(jobTitle) !== job || interviewSlug(candidateName) !== candidate) {
    return jsonError("This invitation does not match this interview room.", 404);
  }

  const scheduledAt = new Date(interview.scheduledAt);
  const meetingType = interview.meetingType === "in-person" ? "in-person" : "video";
  const videoProvider = meetingType === "in-person" ? "flowzen" : normalizeVideoProvider(interview.videoProvider) ?? "flowzen";
  const external = isExternalVideoProvider(videoProvider);

  return NextResponse.json(
    {
      interview: {
        id: String(interview._id),
        candidate: candidateRecord
          ? {
              id: String(candidateRecord._id),
              firstName: asString(candidateRecord.firstName),
              lastName: asString(candidateRecord.lastName),
            }
          : null,
        job: jobRecord
          ? {
              id: String(jobRecord._id),
              title: jobTitle,
              requiredSkills: Array.isArray(jobRecord.requiredSkills)
                ? jobRecord.requiredSkills.filter((skill): skill is string => typeof skill === "string")
                : [],
              description: asString(jobRecord.description),
            }
          : null,
        interviewer: interviewerRecord
          ? {
              id: String(interviewerRecord._id),
              name: asString(interviewerRecord.name, "Interviewer"),
            }
          : null,
        roundType: asString(interview.roundType, "screening"),
        scheduledAt: Number.isNaN(scheduledAt.getTime()) ? "" : scheduledAt.toISOString(),
        meetingType,
        videoProvider,
        // Only external providers expose a join link; a FlowZen room is entered
        // through the invitation URL instead of a third-party address.
        meetingLink: external ? asString(interview.meetingLink) : "",
        meetingPassword: external ? asString(interview.meetingPassword) : "",
        videoProviderLabel: videoProviderLabel(videoProvider),
        location: asString(interview.location),
        status: asString(interview.status, "scheduled"),
        isAssignedInterviewer: false,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
