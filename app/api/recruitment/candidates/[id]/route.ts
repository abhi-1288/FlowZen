import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { withCandidateAccess } from "@/lib/recruitment-candidate-access";
import { jsonError, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "read");
  if (!access.ok) return access.response;
  const { candidate } = access;

  const populated = await ATSCandidate.findById(candidate._id)
    .populate("assignedRecruiter", "name email")
    .populate("assignedTeam.user", "name email")
    .populate("job", "title department location")
    .populate("notes.author", "name email");

  return NextResponse.json({ candidate: serializeDoc(populated!) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const access = await withCandidateAccess(id, "write");
  if (!access.ok) return access.response;
  const { user } = access;

  const body = await request.json();
  const allowedFields = [
    "firstName", "lastName", "email", "phone", "currentCompany", "experienceYears",
    "currentCTC", "expectedCTC", "noticePeriod", "source", "rating",
    "portfolioUrl", "linkedInUrl", "assignedRecruiter", "dob", "address",
    // The candidate's detected STATE. Free text on purpose — it is written by
    // `detect-regions` from the candidate's own address, and the "State" filter
    // matches whatever was detected. It is deliberately NOT the joining region:
    // `joiningRegionLabel` is absent from this allowlist so the bulk transfer
    // endpoint stays the only writer and the offer can keep inheriting one
    // source of truth.
    "regionLabel",
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  // Handle structured notes
  if (body.notes && typeof body.notes === "object") {
    if (body.notes.action === "add") {
      const updateResult = await ATSCandidate.findOneAndUpdate(
        { _id: id, company: user.company },
        { $push: { notes: { author: user._id, content: String(body.notes.content).trim(), createdAt: new Date() } } },
        { new: true }
      )
        .populate("assignedRecruiter", "name email")
        .populate("job", "title");

      if (!updateResult) return jsonError("Candidate not found.", 404);

      await updateResult.populate("notes.author", "name email");

      try {
        const { ATSTimeline } = await import("@/models/ATSTimeline");
        await ATSTimeline.create({
          candidate: id,
          job: updateResult.job,
          action: "note-added",
          metadata: { note: String(body.notes.content).trim().slice(0, 100) },
          actor: user._id,
          company: user.company,
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ candidate: serializeDoc(updateResult) });
    }

    if (body.notes.action === "delete" && body.notes.noteId) {
      const updateResult = await ATSCandidate.findOneAndUpdate(
        { _id: id, company: user.company, "notes._id": body.notes.noteId, "notes.author": user._id },
        { $pull: { notes: { _id: body.notes.noteId } } },
        { new: true }
      )
        .populate("assignedRecruiter", "name email")
        .populate("job", "title");

      if (!updateResult) return jsonError("Note not found or not authorized.", 404);

      return NextResponse.json({ candidate: serializeDoc(updateResult) });
    }
  }

  const candidate = await ATSCandidate.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("assignedRecruiter", "name email")
    .populate("job", "title")
    .populate("notes.author", "name email");

  if (!candidate) return jsonError("Candidate not found.", 404);

  return NextResponse.json({ candidate: serializeDoc(candidate) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  // Deletion stays admin-only, so the reader gate resolves the region boundary
  // and the role is re-checked here.
  const access = await withCandidateAccess(id, "read");
  if (!access.ok) return access.response;
  const { user } = access;

  if (user.role !== "admin") return jsonError("Forbidden", 403);

  await connectDb();
  await ATSCandidate.findOneAndDelete({ _id: id, company: user.company });

  return NextResponse.json({ ok: true });
}
