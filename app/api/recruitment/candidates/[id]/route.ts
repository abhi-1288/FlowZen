import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];
const ALL_ROLES = [...HR_ROLES, "project-manager", "qa-tester", "finance"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
  if (!user || (!ALL_ROLES.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company })
    .populate("assignedRecruiter", "name email")
    .populate("assignedTeam.user", "name email")
    .populate("job", "title department")
    .populate("notes.author", "name email");

  if (!candidate) return jsonError("Candidate not found.", 404);

  return NextResponse.json({ candidate: serializeDoc(candidate) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  const body = await request.json();
  const allowedFields = [
    "firstName", "lastName", "email", "phone", "currentCompany", "experienceYears",
    "currentCTC", "expectedCTC", "noticePeriod", "source", "rating",
    "portfolioUrl", "linkedInUrl", "assignedRecruiter", "dob", "address",
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  // Handle structured notes
  if (body.notes && typeof body.notes === "object") {
    if (body.notes.action === "add") {
      const updateResult = await ATSCandidate.findOneAndUpdate(
        { _id: id, company: user.company },
        { $push: { notes: { author: userId, content: String(body.notes.content).trim(), createdAt: new Date() } } },
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
          actor: userId,
          company: user.company,
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ candidate: serializeDoc(updateResult) });
    }

    if (body.notes.action === "delete" && body.notes.noteId) {
      const updateResult = await ATSCandidate.findOneAndUpdate(
        { _id: id, company: user.company, "notes._id": body.notes.noteId, "notes.author": userId },
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
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || user.role !== "admin") return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOneAndDelete({ _id: id, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);

  return NextResponse.json({ ok: true });
}
