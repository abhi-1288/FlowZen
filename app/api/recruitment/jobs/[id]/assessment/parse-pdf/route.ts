import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { parseAssessmentPdf } from "@/lib/assessment-pdf-parser";

const HR_ROLES = ["admin", "human-resource"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("A PDF file is required.");
  if (!file.type.toLowerCase().includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return jsonError("Only PDF files are supported.");
  }
  if (file.size <= 0) return jsonError("The PDF file is empty.");
  if (file.size > MAX_SIZE_BYTES) return jsonError("PDF must be 10MB or smaller.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("_id assessment");
  if (!job) return jsonError("Job not found.", 404);
  if (!job.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseAssessmentPdf(buffer);
    if (!result.questions.length) {
      return jsonError(
        "No questions could be detected in this PDF. Add numbered questions with A/B/C/D options and an answer key, then try again.",
        400
      );
    }
    return NextResponse.json({ questions: result.questions, warnings: result.warnings, count: result.questions.length });
  } catch (e: any) {
    return jsonError(e?.message || "Failed to parse the PDF.", 500);
  }
}