import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import {
  regionEntryOf,
  regionLabelsOf,
  regionStaffingOf,
  withMainOfficeSuffixByLabel,
} from "@/lib/company-regions";
import { canTransferCandidates, candidateRegionClause } from "@/lib/candidate-region-scope";
import { regionJoinApproverId } from "@/lib/join-approvers";

type Params = { params: Promise<{ id: string }> };

type LiveRegion = {
  label: string;
  /** Cleared when the configured head is no longer an approved member. */
  hrHead: string;
  adminHead: string;
  hrIds: string[];
  adminIds: string[];
  hrCount: number;
  adminCount: number;
  eligible: boolean;
};

/**
 * Staffing that resolves to people who can actually receive a candidate.
 *
 * A region's `hrs[]` / `admins[]` and head slots are raw ids that nothing
 * garbage-collects. A member can leave the company, have their approval revoked,
 * or simply be a stale row, and the region then looks staffed on paper while no
 * one can act on what arrives. Since this route's whole safety argument is "we
 * refuse to send a batch somewhere nobody owns", the check has to run against
 * live approved members — otherwise the refusal only fires for a region that
 * was never configured at all, which is the rare case, and stays silent for the
 * common one.
 *
 * One query for every region, because the sender usually sees the whole list and
 * a per-region lookup would be a request each.
 */
async function resolveLiveRegions(companyId: unknown, labels: string[], company: any): Promise<LiveRegion[]> {
  const configured = labels.map((label) => ({
    label,
    staffing: regionStaffingOf(regionEntryOf(company, label)),
  }));

  const allIds = Array.from(
    new Set(
      configured
        .flatMap(({ staffing }) => [
          staffing.hrHead,
          staffing.adminHead,
          ...staffing.hrs,
          ...staffing.admins,
        ])
        .filter(Boolean)
        .map(String),
    ),
  );

  const liveIds = new Set<string>(
    allIds.length
      ? (
          await User.find({
            _id: { $in: allIds },
            company: companyId,
            companyStatus: "approved",
          })
            .select("_id")
            .lean()
        ).map((u: any) => String(u._id))
      : [],
  );

  return configured.map(({ label, staffing }) => {
    const keep = (id: string) => (id && liveIds.has(String(id)) ? String(id) : "");
    const hrIds = staffing.hrs.filter((id) => liveIds.has(id));
    const adminIds = staffing.admins.filter((id) => liveIds.has(id));
    const hrHead = keep(staffing.hrHead);
    const adminHead = keep(staffing.adminHead);
    return {
      label,
      hrHead,
      adminHead,
      hrIds,
      adminIds,
      hrCount: hrIds.length,
      adminCount: adminIds.length,
      eligible: Boolean(hrHead || adminHead || hrIds.length || adminIds.length),
    };
  });
}

/**
 * Transfer a batch of candidates to a region, so that region's HR/Admin can run
 * the offer.
 *
 * This is the step that makes the rest of the regional pipeline mean something.
 * Before it, `ATSCandidate.joiningRegionLabel` was empty for everyone, the
 * offer stamped whatever region the generating HR sat in, and the join approval
 * went to whoever clicked Convert — so a Pune hire could be filed under Pune or
 * left unowned depending on who was logged in.
 *
 * Design notes:
 *   - The transfer sets the region, and the offer *inherits* it. The offer form
 *     has no region picker, so there is exactly one place a candidate's region is
 *     decided and two writable copies cannot drift.
 *   - Re-sending is allowed and audited. `previousJoiningRegionLabel` keeps the
 *     last region and each candidate gets a `region-assigned` timeline entry, so
 *     a mis-routed batch is visible rather than silently corrected.
 *   - A region with no head and no roster is rejected outright. Sending there
 *     would create candidates nobody can act on, and the alternative — silently
 *     routing them elsewhere — hides the misconfiguration.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  // `owner` is selected so `canTransferCandidates` can recognise a company
  // owner who is not also HR/admin.
  const company = (await Company.findById(user.company)
    .select("owner addresses address name")
    .lean()) as any;
  if (!company) return jsonError("No company found.", 400);
  if (!canTransferCandidates(company, user)) return jsonError("Forbidden", 403);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("_id title");
  if (!job) return jsonError("Job not found.", 404);

  const labels = regionLabelsOf(company);
  const live = await resolveLiveRegions(user.company, labels, company);

  // Name the heads so the sender can confirm who will own the batch before
  // committing to it.
  const nameIds = Array.from(
    new Set(live.flatMap((r) => [r.hrHead, r.adminHead, ...r.hrIds, ...r.adminIds]).filter(Boolean)),
  );
  const people = nameIds.length
    ? await User.find({ _id: { $in: nameIds }, company: user.company })
        .select("name role regionLabel")
        .lean()
    : [];
  const names = new Map(people.map((p: any) => [String(p._id), String(p.name ?? "")]));

  return NextResponse.json({
    regions: live.map((r) => ({
      label: r.label,
      displayLabel: withMainOfficeSuffixByLabel("", r.label),
      hrHead: r.hrHead,
      adminHead: r.adminHead,
      hrCount: r.hrCount,
      adminCount: r.adminCount,
      // Mirrors the POST's rejection rule so the modal disables the same regions
      // the endpoint would refuse, instead of letting the user fill a form only
      // to be told no.
      eligible: r.eligible,
      hrHeadName: r.hrHead ? names.get(r.hrHead) || "" : "",
      adminHeadName: r.adminHead ? names.get(r.adminHead) || "" : "",
    })),
    hasRegions: labels.length > 0,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const company = (await Company.findById(user.company)
    .select("owner addresses address name")
    .lean()) as any;
  if (!company) return jsonError("No company found.", 400);
  if (!canTransferCandidates(company, user)) return jsonError("Forbidden", 403);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("_id title");
  if (!job) return jsonError("Job not found.", 404);

  const body = await request.json().catch(() => ({}));
  const candidateIds: string[] = Array.isArray(body.candidateIds)
    ? body.candidateIds.filter((c: unknown) => isObjectId(c as string))
    : [];
  if (candidateIds.length === 0) return jsonError("Select at least one candidate.", 400);

  const requestedRegion = String(body.regionLabel ?? "").trim();
  if (!requestedRegion) return jsonError("Select a region to send these candidates to.", 400);

  const labels = regionLabelsOf(company);
  if (labels.length === 0) {
    return jsonError(
      "This company has no offices configured, so there is no region to send candidates to.",
      409,
    );
  }

  // Match the company's real office label rather than storing whatever the client
  // sent, so casing and stray whitespace never fork the region identity.
  const regionLabel =
    labels.find((l) => l.toLowerCase() === requestedRegion.toLowerCase()) ?? "";
  if (!regionLabel) {
    return jsonError(`"${requestedRegion}" is not a configured office.`, 400);
  }

  // Resolved against live approved members, not the raw ids on the office, so a
  // region whose staff have all left is treated exactly like an unstaffed one.
  const target = (await resolveLiveRegions(user.company, [regionLabel], company))[0];
  if (!target?.eligible) {
    return jsonError(
      `${regionLabel} has no approved HR head, Admin head or HR/Admin roster, so nobody would receive these candidates. Staff the region first.`,
      409,
    );
  }
  const staffing = {
    hrHead: target.hrHead,
    adminHead: target.adminHead,
    hrs: target.hrIds,
    admins: target.adminIds,
  };

  const candidates = await ATSCandidate.find({
    _id: { $in: candidateIds },
    job: job._id,
    company: user.company,
    // Without this clause any regional HR could POST a guessed candidate id and
    // steal another region's candidate, which would both defeat the visibility
    // boundary and let two regions fight over one pipeline row. A regional HR can
    // still route the unassigned pool and their own region.
    ...candidateRegionClause(company, user),
  }).select("_id firstName lastName joiningRegionLabel");

  if (candidates.length === 0) return jsonError("No matching candidates on this job.", 404);

  // Requested ids that did not come back are either gone or outside the sender's
  // region. The two are reported as one number on purpose: distinguishing them
  // would turn this endpoint into an existence oracle for foreign candidates.
  const notVisible = Math.max(0, candidateIds.length - candidates.length);

  const now = new Date();
  const moved: Array<{ id: string; name: string; from: string }> = [];
  const unchanged: string[] = [];
  const skipped: string[] = [];

  for (const candidate of candidates) {
    const from = String(candidate.joiningRegionLabel ?? "").trim();
    // Already there: not an error, just nothing to do. Still recorded so the
    // caller can distinguish "sent" from "was already correct".
    if (from.toLowerCase() === regionLabel.toLowerCase()) {
      unchanged.push(String(candidate._id));
      continue;
    }

    try {
      await ATSCandidate.updateOne(
        { _id: candidate._id, company: user.company },
        {
          $set: {
            joiningRegionLabel: regionLabel,
            previousJoiningRegionLabel: from,
            joiningRegionAssignedBy: userId,
            joiningRegionAssignedAt: now,
          },
        }
      );

      await ATSTimeline.create({
        candidate: candidate._id,
        job: job._id,
        action: "region-assigned",
        metadata: {
          regionLabel,
          previousRegionLabel: from,
          // Empty for a first transfer; kept explicit so the timeline renders
          // "unassigned -> Noida" rather than a blank.
          wasUnassigned: !from,
          movedInBatch: candidates.length,
        },
        actor: userId,
        company: user.company,
      });

      moved.push({
        id: String(candidate._id),
        name: `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim(),
        from,
      });
    } catch (err) {
      console.error("Failed to transfer candidate to region:", candidate._id, err);
      skipped.push(String(candidate._id));
    }
  }

  if (moved.length > 0) {
    await ATSAuditLog.create({
      actor: userId,
      action: "bulk-region-transfer",
      entityType: "ATSJob",
      entityId: job._id,
      metadata: {
        regionLabel,
        movedCount: moved.length,
        skippedCount: skipped.length,
        candidateNames: moved.map((m) => m.name).slice(0, 50),
        reassigned: moved.filter((m) => m.from).map((m) => m.name).slice(0, 50),
      },
      company: user.company,
    });
  }

  // Notify the region's heads and staff. The heads get a firmer message because
  // they are the ones who will end up approving the join.
  const displayRegion = withMainOfficeSuffixByLabel("", regionLabel);
  const regionTitle = displayRegion || regionLabel;
  const recipientIds = Array.from(
    new Set(
      [staffing.hrHead, staffing.adminHead, ...staffing.hrs, ...staffing.admins].filter(Boolean),
    ),
  ).filter((rid) => rid !== userId);

  if (moved.length > 0 && recipientIds.length > 0) {
    const recipientDocs = await User.find({
      _id: { $in: recipientIds },
      company: user.company,
    }).select("_id name role");
    const headIds = new Set([staffing.hrHead, staffing.adminHead].filter(Boolean).map(String));

    for (const recipient of recipientDocs) {
      const isHead = headIds.has(String(recipient._id));
      const count = moved.length;
      const message = isHead
        ? `${count} candidate${count === 1 ? "" : "s"} for ${(job as any).title} sent to ${regionTitle}. You will be asked to approve the join.`
        : `${count} candidate${count === 1 ? "" : "s"} for ${(job as any).title} sent to ${regionTitle}. Generate the offer to take it forward.`;
      try {
        await Notification.create({
          user: recipient._id,
          company: user.company,
          type: "info",
          title: isHead ? `Candidates Sent to ${regionTitle}` : `New Candidates for ${regionTitle}`,
          message,
          link: `/recruitment/jobs/${id}`,
        });
        emitToUser(String(recipient._id), "notification:new", { message });
        emitToUser(String(recipient._id), "recruitment:update", {
          type: "region-assigned",
          jobId: id,
          regionLabel,
        });
      } catch (notifyErr) {
        console.error("Failed to notify region recipient:", recipient._id, notifyErr);
      }
    }
  }

  // The sender's own list changes shape when the batch leaves the unassigned
  // pool, so nudge the tab they are looking at.
  emitToUser(String(userId), "recruitment:update", {
    type: "region-assigned",
    jobId: id,
    regionLabel,
  });

  // Resolved here so the response can tell the sender who owns the batch next,
  // which is the thing most likely to be misconfigured.
  const regionHeadId = await regionJoinApproverId(user.company, regionLabel);

  return NextResponse.json({
    moved: moved.length,
    unchanged: unchanged.length,
    skipped: skipped.length,
    notVisible,
    region: regionLabel,
    regionLabel: regionTitle,
    regionHasApprover: Boolean(regionHeadId),
    candidates: moved,
  });
}
