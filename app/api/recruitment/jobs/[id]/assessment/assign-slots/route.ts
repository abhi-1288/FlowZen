import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { dateInputValue, wallClockToIso } from "@/lib/date-utils";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * Bulk-assign the job's candidates across the configured slots.
 *
 * Returns the stored values (read back after the write) so the modal never has
 * to guess whether a PATCH/serialization mismatch left a candidate unassigned.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const user = await User.findById(userId).select("company").lean();
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!(user as any)?.company) return jsonError("No company found.", 400);

  const body = await request.json().catch(() => ({}));
  await connectDb();

  const job = await ATSJob.findOne({ _id: id, company: (user as any).company })
    .select("assessmentDate assessment")
    .lean();
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await ATSAssessment.findOne({ job: id, company: (user as any).company })
    .select("timeSlots")
    .lean();

  // Prefer what the modal sent, but fall back to the saved assessment so a
  // stale/partial page payload cannot silently write null slots.
  const rawSlots: string[] = Array.isArray(body.slots)
    ? body.slots.filter((s: unknown): s is string => typeof s === "string" && HHMM.test(s.trim()))
    : [];
  const savedSlots: string[] = Array.isArray((assessment as any)?.timeSlots)
    ? (assessment as any).timeSlots.map((s: any) => String(s?.start || "")).filter((s: string) => HHMM.test(s))
    : [];
  const slots = rawSlots.length ? rawSlots : savedSlots.length ? savedSlots : ["09:00"];

  const rawDate = typeof body.assessmentDate === "string" ? body.assessmentDate : "";
  const assessmentDate = rawDate || (job as any).assessmentDate || "";
  if (!assessmentDate || Number.isNaN(new Date(assessmentDate).getTime())) {
    return jsonError("Set a valid assessment date before assigning slots.", 400);
  }
  const day = dateInputValue(String(assessmentDate));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return jsonError("Could not resolve the assessment date in IST.", 400);
  }

  const candidates = await ATSCandidate.find({ job: id, company: (user as any).company })
    .select("_id")
    .lean();
  if (candidates.length === 0) return jsonError("No candidates available to assign.", 400);

  const candidateIds: string[] = Array.isArray(body.candidateIds)
    ? body.candidateIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  let targets = candidates;
  if (candidateIds.length) {
    const wanted = new Set(candidateIds);
    const matched = candidates.filter((c: any) => wanted.has(String(c._id)));
    // Only trust the client's list when it actually resolves to docs. Otherwise
    // fall back to the whole cohort instead of writing nothing.
    if (matched.length) targets = matched;
  }

  const n = targets.length;
  const k = slots.length;
  const base = Math.floor(n / k);
  const rem = n % k;
  const values: string[] = [];
  for (const slot of slots) {
    const iso = wallClockToIso(day, slot, "09:00");
    if (!iso) return jsonError(`Invalid slot time: ${slot}`, 400);
    values.push(iso);
  }

  const bulk: { updateOne: { filter: { _id: unknown }; update: { $set: { assessmentSlotStart: Date } } } }[] = [];
  let idx = 0;
  for (let s = 0; s < k; s++) {
    const count = base + (s < rem ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const candidate = targets[idx++];
      if (!candidate) break;
      bulk.push({
        updateOne: {
          filter: { _id: (candidate as any)._id },
          update: { $set: { assessmentSlotStart: new Date(values[s]) } },
        },
      });
    }
  }
  if (bulk.length) await ATSCandidate.bulkWrite(bulk);

  // Read back from Mongo so the response reflects exactly what was persisted.
  const assigned = await ATSCandidate.find({ _id: { $in: targets.map((c: any) => c._id) } })
    .select("_id assessmentSlotStart")
    .lean();
  const rows: Array<{ id: string; assessmentSlotStart: string | null }> = assigned.map((c: any) => ({
    id: String(c._id),
    assessmentSlotStart: c.assessmentSlotStart ? new Date(c.assessmentSlotStart).toISOString() : null,
  }));
  const assignments: Record<string, string | null> = Object.fromEntries(
    rows.map((r: { id: string; assessmentSlotStart: string | null }) => [r.id, r.assessmentSlotStart])
  );

  return NextResponse.json({
    ok: true,
    assignments,
    candidates: rows,
    count: bulk.length,
    slots,
    day,
  });
}
