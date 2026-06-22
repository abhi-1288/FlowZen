import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSTimeline } from "@/models/ATSTimeline";
import { User } from "@/models/User";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid candidate id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const candidate = await ATSCandidate.findOne({ _id: id, company: user.company });
  if (!candidate) return jsonError("Candidate not found.", 404);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return jsonError("No file provided.", 400);

  const ext = file.name.split(".").pop() || "pdf";
  const fileName = `resume-${id}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "resumes");
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  const url = `/uploads/resumes/${fileName}`;

  candidate.resumeUrl = url;
  await candidate.save();

  await ATSTimeline.create({
    candidate: candidate._id,
    job: candidate.job,
    action: "resume-uploaded",
    metadata: { fileName: file.name, url },
    actor: userId,
    company: user.company,
  });

  return NextResponse.json({ url });
}
