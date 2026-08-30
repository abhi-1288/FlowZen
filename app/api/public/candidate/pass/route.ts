import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSInterview } from "@/models/ATSInterview";
import { isObjectId, jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";

type PassResult =
  | { valid: false; error: string }
  | {
      valid: true;
      pass: {
        candidateId: string;
        candidateName: string;
        role: string;
        company: string;
        roundType: string;
        scheduledAt: string;
        location: string;
        interviewer: string;
      };
    };

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const separatorIndex = token.lastIndexOf(":");
  const hasQrFormat = separatorIndex > 0 && separatorIndex < token.length - 1;

  if (hasQrFormat) {
    const magicToken = token.slice(0, separatorIndex);
    const interviewId = token.slice(separatorIndex + 1);
    if (!interviewId || !isObjectId(interviewId)) {
      return jsonError("Invalid pass token.", 400);
    }

    const candidate = await findCandidateByToken(magicToken);
    if (!candidate) {
      const result: PassResult = { valid: false, error: "Invalid or expired pass link." };
      return NextResponse.json(result, { status: 401 });
    }

    const interview: any = await ATSInterview.findOne({
      _id: interviewId,
      candidate: candidate._id,
      company: candidate.company,
      status: "scheduled",
    })
      .populate("candidate", "firstName lastName email")
      .populate("job", "title")
      .populate("company", "name")
      .populate("interviewer", "name");

    if (!interview || !interview.location) {
      const result: PassResult = { valid: false, error: "This interview pass is not valid for access." };
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(buildPassResult(candidate, interview));
  }

  // Plain scannable Pass ID (e.g. FLOWZ-64E519)
  const interview: any = await ATSInterview.findOne({
    passCode: { $regex: new RegExp(`^${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    location: { $ne: "" },
    status: "scheduled",
  })
    .populate("candidate", "firstName lastName email")
    .populate("job", "title")
    .populate("company", "name")
    .populate("interviewer", "name");

  if (!interview) {
    const result: PassResult = { valid: false, error: "No match found for this code." };
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(buildPassResult(interview.candidate as any, interview));
}

function buildPassResult(candidate: any, interview: any): PassResult {
  const candidateName = `${candidate?.firstName ?? ""} ${candidate?.lastName ?? ""}`.trim();
  const interviewDate = interview.scheduledAt
    ? new Date(interview.scheduledAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return {
    valid: true,
    pass: {
      candidateId: String(candidate._id),
      candidateName,
      role: interview.job?.title ?? "Position",
      company: interview.company?.name ?? "",
      roundType: interview.roundType ?? "interview",
      scheduledAt: interviewDate,
      location: interview.location,
      interviewer: interview.interviewer?.name ?? "",
    },
  };
}
