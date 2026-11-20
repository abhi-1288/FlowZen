import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { dateInputValue, wallClockToIso } from "@/lib/date-utils";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const user = await User.findById(userId).select("company").lean();
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!(user as any)?.company) return jsonError("No company found.", 400);

  const body = await request.json().catch(() => ({}));
  const slots: string[] = Array.isArray(body.slots) ? body.slots.filter((s: unknown) => typeof s === "string" && s.trim()) : [];
  const assessmentDate = typeof body.assessmentDate === "string" ? body.assessmentDate : "";
  const candidateIds: string[] = Array.isArray(body.candidateIds) ? body.candidateIds.filter((x: unknown) => typeof x === "string") : [];
  if (!assessmentDate) return jsonError("Set the assessment date before assigning slots.", 400);
  if (slots.length === 0) slots.push("09:00");

  await connectDb();
  const candidates = await ATSCandidate.find({
    job: id,
    company: (user as any).company,
    ...(candidateIds.length ? { _id: { $in: candidateIds } } : {}),
  })
    .select("_id");
  if (candidateIds.length) {
    candidates.sort((a: any, b: any) => candidateIds.indexOf(String(a._id)) - candidateIds.indexOf(String(b._id)));
  } else {
    candidates.sort((a: any, b: any) => String(b._id).localeCompare(String(a._id)));
  }
  if (candidates.length === 0) return jsonError("No candidates available to assign.", 400);

  const day = dateInputValue(assessmentDate);
  const n = candidates.length;
  const k = slots.length;
  const base = Math.floor(n / k);
  const rem = n % k;
  const bulk: { updateOne: { filter: { _id: unknown }; update: { $set: { assessmentSlotStart: Date | null } } } }[] = [];
  const assignments: Record<string, string | null> = {};
  let idx = 0;
  for (let s = 0; s < k; s++) {
    const count = base + (s < rem ? 1 : 0);
    const iso = wallClockToIso(day, slots[s], "09:00");
    const value = iso ? new Date(iso) : null;
    for (let i = 0; i < count; i++) {
      const candidate = candidates[idx++];
      if (!candidate) break;
      bulk.push({
        updateOne: {
          filter: { _id: (candidate as any)._id },
          update: { $set: { assessmentSlotStart: value } },
        },
      });
      assignments[String((candidate as any)._id)] = iso;
    }
  }
  if (bulk.length) await ATSCandidate.bulkWrite(bulk);

  return NextResponse.json({ ok: true, assignments, count: bulk.length });
}
