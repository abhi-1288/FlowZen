import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { getCandidateDeadlineMs } from "@/lib/assessment";
import { MAX_EXTENSION_MS } from "@/lib/assessment-proctoring";

/**
 * A candidate asking for more time during a proctored sitting.
 *
 * Extensions are only granted by HR, never by this endpoint: it records the
 * request and returns immediately. That keeps a candidate from extending their
 * own clock, and gives HR a reason to look — a request is itself a signal that
 * something went wrong (a blocked screen, a locked-down laptop, a power cut).
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  const body = await request.json().catch(() => ({}));
  const requestedMinutes = Math.round(Number(body?.minutes));
  const note = String(body?.note ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  if (!Number.isFinite(requestedMinutes) || requestedMinutes < 1) {
    return jsonError("Enter how many extra minutes you need.", 400);
  }
  const requestedMs = Math.min(requestedMinutes * 60 * 1000, MAX_EXTENSION_MS);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);
  if (candidate.stage !== "assessment") return jsonError("You are not in the assessment stage.", 400);
  if (!(candidate as any).assessmentStartedAt) return jsonError("The assessment has not started.", 400);
  if ((candidate as any).assessmentSubmittedAt) return jsonError("Already submitted.", 400);

  const proctoring = ((candidate as any).assessmentProctoring ?? {}) as Record<string, any>;
  if (proctoring.extensionRequestStatus === "pending") {
    return jsonError("You already have a request waiting for review.", 409);
  }

  const updated = await ATSCandidate.findOneAndUpdate(
    { _id: candidate._id, assessmentSubmittedAt: null },
    {
      $set: {
        "assessmentProctoring.extensionRequestStatus": "pending",
        "assessmentProctoring.extensionRequestedMs": requestedMs,
        "assessmentProctoring.extensionRequestNote": note,
      },
    },
    { new: false }
  );
  if (!updated) return jsonError("Already submitted.", 409);

  const endsAt = getCandidateDeadlineMs(
    {
      assessmentStartedAt: (candidate as any).assessmentStartedAt,
      assessmentProctoring: (updated.assessmentProctoring ?? {}) as Record<string, any>,
    },
    null
  );

  return NextResponse.json({
    ok: true,
    status: "pending",
    requestedMs,
    // Reported so the portal can tell the candidate how long the request is for
    // without echoing back anything internal.
    requestedLabel: `${requestedMs / 60000} minute${requestedMs === 60000 ? "" : "s"}`,
    endsAt,
  });
}

/** Read-only: lets the portal re-check a pending request after a reload. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();
  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const proctoring = ((candidate as any).assessmentProctoring ?? {}) as Record<string, any>;
  const granted = Math.max(0, Number(proctoring.extensionMs) || 0);

  return NextResponse.json({
    status: proctoring.extensionRequestStatus || "none",
    requestedMs: Math.max(0, Number(proctoring.extensionRequestedMs) || 0),
    grantedMs: granted,
    grantedMinutes: granted ? Math.round(granted / 60000) : 0,
  });
}
