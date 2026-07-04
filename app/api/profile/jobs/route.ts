import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { autoCloseOverdueJobs } from "@/lib/recruitment-utils";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  await autoCloseOverdueJobs();

  const user = await User.findById(userId);
  if (!user || !user.company) return jsonError("No company found.", 400);

  const jobs = await ATSJob.find({ company: user.company, status: "open" })
    .populate("company", "name")
    .sort({ createdAt: -1 });

  return NextResponse.json({ jobs: jobs.map((j: any) => serializeDoc(j)) });
}
