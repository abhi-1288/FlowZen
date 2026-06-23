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
  if (!user || !ALL_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company })
    .populate("assignedRecruiter", "name email")
    .populate("assignedTeam.user", "name email")
    .populate("job", "title department");

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
    "currentCTC", "expectedCTC", "noticePeriod", "source", "rating", "notes",
    "portfolioUrl", "linkedInUrl", "assignedRecruiter",
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  )
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");

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
