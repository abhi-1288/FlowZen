import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { CORE_STAGES, STAGES, STAGE_LABELS, TERMINAL_STAGES, type Stage } from "@/lib/recruitment-types";
import { canRunRecruitmentPipeline, requireRecruitmentHQ } from "@/lib/recruitment-hq";

const HR_ROLES = ["admin", "human-resource"];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Unauthorized", 401);
  if (!user.company) return jsonError("No company found.", 400);

  const company = await Company.findById(user.company);
  const order = Array.isArray(company?.stageOrder) && company.stageOrder.length ? company.stageOrder : STAGES;

  const ordered = order.filter((s: string) => (STAGES as string[]).includes(s));
  const missing = STAGES.filter((s) => !ordered.includes(s));
  const stages = [...ordered, ...missing];

  return NextResponse.json({
    stages: stages.map((stage) => ({
      id: stage,
      label: STAGE_LABELS[stage as Stage],
    })),
    // Stage order is company-wide: reordering it renames the pipeline every
    // region's candidates sit in, so it follows the pipeline owner rather than
    // the role string. Otherwise a region HR could restructure the main office's
    // funnel from their own office.
    canManage: canRunRecruitmentPipeline(company as any, user as any),
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const next = Array.isArray(body?.stages) ? body.stages : null;
  if (!next || next.length !== CORE_STAGES.length) return jsonError("Invalid stage order.");

  if (new Set(next).size !== next.length) return jsonError("Duplicate stages in order.");
  for (const s of next) {
    if (!CORE_STAGES.includes(s as Stage)) return jsonError("Invalid stage in order.");
  }

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Unauthorized", 401);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!user.company) return jsonError("No company found.", 400);

  const stageOrder = [...(next as Stage[]), ...TERMINAL_STAGES];
  await Company.updateOne({ _id: user.company }, { $set: { stageOrder } });

  const hrAndAdmin = await User.find({ company: user.company, role: { $in: HR_ROLES } });
  for (const u of hrAndAdmin) {
    if (String(u._id) === String(userId)) continue;
    emitToUser(String(u._id), "recruitment:update", { type: "stages-reordered" });
  }

  return NextResponse.json({
    stages: stageOrder.map((stage) => ({ id: stage, label: STAGE_LABELS[stage] })),
  });
}