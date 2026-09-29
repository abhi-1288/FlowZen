import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { resolveSeniorSecurityApprover, findApprovedApproverIdForRequester, requesterRegionScope } from "@/lib/join-approvers";
import { isUserInRegion } from "@/lib/company-regions";
import {
  buildApproverPlan,
  resolvePrimaryHrApprover,
  resolveTeamOwnerSignatory,
  DOCUMENT_LETTER_PRIMARY_ROLES,
  RegionMismatchError,
  type SignatoryPlanEntry,
} from "@/lib/document-letter-approvers";
import { MAX_LETTER_CO_APPROVERS } from "@/lib/document-letter-signatories";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();

    const actor = await User.findById(userId).select("role company companyStatus");
    if (!actor) return jsonError("User not found.", 404);

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    const isHr = String(actor.role) === "human-resource";
    const isAdmin = String(actor.role) === "admin";

    // ?plan=1 previews the approver plan for the current requester so the modal
    // can show the same auto-resolved HR the server will use, plus the team owner
    // it may *suggest*. The suggestion is never applied automatically.
    if (url.searchParams.get("plan") === "1" && actor.company) {
      const requesterDoc = await User.findById(userId).select("team activeTeams");
      const { region, clause, company } = await requesterRegionScope(String(actor.company), requesterDoc);
      const plan = await buildApproverPlan({
        requester: requesterDoc as never,
        companyId: String(actor.company),
        region,
        regionClause: clause,
        company,
      });
      const { entry: teamOwner, blockedReason } = await resolveTeamOwnerSignatory({
        requester: requesterDoc as never,
        companyId: String(actor.company),
        region,
        company,
      });
      const primary = plan.primaryId
        ? await User.findById(plan.primaryId).select("name role").lean()
        : null;
      return NextResponse.json({
        region,
        primary: primary
          ? { id: plan.primaryId, name: String((primary as any).name ?? ""), role: String((primary as any).role ?? "") }
          : null,
        teamOwner: teamOwner
          ? { user: teamOwner.user, name: teamOwner.name, role: teamOwner.role }
          : null,
        // Lets the modal explain an absent suggestion instead of silently
        // hiding it, e.g. the team owner sits in another region.
        teamOwnerBlockedReason: blockedReason,
        maxCoApprovers: MAX_LETTER_CO_APPROVERS,
      });
    }

    const filter: Record<string, unknown> = {
      kind: "document-letter",
    };

    // scope=company returns all company docs for HR and Admin
    if (scope === "company" && (isHr || isAdmin) && actor.company) {
      filter.company = actor.company;
    } else if (isHr && actor.company) {
      filter.company = actor.company;
    } else {
      // A nominated co-approver has to be able to open the letter in order to
      // sign it, even though they did not request it. Anyone else still sees
      // only their own letters.
      filter.$or = [
        { requester: userId },
        { signatories: { $elemMatch: { user: userId } } },
      ];
    }

    const requests = await JoinRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("requester", "name email role companyIdentityCode companyJoined employmentEndDate baseSalary pfNumber pfDeductionAmount esicNumber esicDeductionAmount pfExempted esicExempted tdsExempted")
      .populate("approver", "name role")
      .populate("company", "name icon")
      .lean();

    return NextResponse.json({ requests });
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();

    const requester = await User.findById(userId);
    if (!requester) return jsonError("User not found.", 404);
    if (!requester.company || requester.companyStatus !== "approved") {
      return jsonError("You must be in an approved company to request a document letter.", 400);
    }

    const body = await request.json();
    const letterType = String(body.letterType ?? "").trim();
    const purpose = String(body.purpose ?? "").trim();
    const customType = String(body.customType ?? "").trim();
    const customApproverId = String(body.approverId ?? "").trim();

    const validTypes = ["experience", "salary-certificate", "offer-letter", "relieving", "internship", "resignation", "final-settlement", "form-16", "noc", "exit-agreement", "employee-recognition", "other"];
    if (!validTypes.includes(letterType)) {
      return jsonError("Invalid letter type.", 400);
    }
    if (!purpose) {
      return jsonError("Purpose is required.", 400);
    }
    if (letterType === "other" && !customType) {
      return jsonError("Custom letter type is required.", 400);
    }
    if (letterType === "internship") {
      const internshipStart = String(body.internshipStart ?? "").trim();
      const internshipEnd = String(body.internshipEnd ?? "").trim();
      if (!internshipStart || !internshipEnd) {
        return jsonError("Internship start and end dates are required.", 400);
      }
      const projectTitle = String(body.projectTitle ?? "").trim();
      const projectDescription = String(body.projectDescription ?? "").trim();
      if (!projectTitle) return jsonError("Project title is required.", 400);
      if (!projectDescription) return jsonError("Project description is required.", 400);
    }
    if (letterType === "resignation") {
      const resignationLastWorkingDay = String(body.resignationLastWorkingDay ?? "").trim();
      if (!resignationLastWorkingDay) {
        return jsonError("Last working day is required for resignation letter.", 400);
      }
    }

    const companyId = String(requester.company);
    const { region: requesterRegion, clause: regionClause, company: regionCompany } =
      await requesterRegionScope(companyId, requester);

    // Co-approvers are nominated entirely by the requester. Accept an array, a
    // lone string, or nothing at all, so older clients keep working.
    const rawCoApproverIds = Array.isArray(body.coApproverIds)
      ? body.coApproverIds
      : body.coApproverId !== undefined
        ? [body.coApproverId]
        : [];
    const coApproverIds = rawCoApproverIds
      .map((value: unknown) => String(value ?? "").trim())
      .filter(Boolean);
    const teamOwnerId = String(body.teamOwnerId ?? "").trim();

    const nomineeCount =
      coApproverIds.length + (teamOwnerId ? 1 : 0);
    if (nomineeCount > MAX_LETTER_CO_APPROVERS) {
      return jsonError(
        `You can add at most ${MAX_LETTER_CO_APPROVERS} co-approvers to a letter.`,
        400,
      );
    }

    let approverId: string | null = null;
    let customApproverIsSeniorSecurity = false;

    if (customApproverId) {
      const customApprover = await User.findById(customApproverId)
        .select("role regionLabel company companyStatus isSeniorSecurity");
      const isSeniorSecurityForCustom = String(customApprover?.role) === "security" && Boolean((customApprover as any)?.isSeniorSecurity);

      const pickedRole = String(customApprover?.role);
      // The primary approver is HR. Junior security may also route to a senior
      // security approver; that exception is preserved.
      const validRole = pickedRole === "human-resource" || isSeniorSecurityForCustom;

      if (
        !customApprover ||
        String(customApprover.company) !== companyId ||
        customApprover.companyStatus !== "approved" ||
        !validRole
      ) {
        return jsonError("Selected approver is not a valid approver in your company.", 400);
      }

      // Region enforcement: reject an out-of-region pick, but only when the
      // requester's region actually has an approver — otherwise nobody there
      // could submit a request at all.
      if (regionClause && !isUserInRegion(regionCompany, requesterRegion, customApprover)) {
        const regionHasApprover = await findApprovedApproverIdForRequester({
          companyId,
          roles: DOCUMENT_LETTER_PRIMARY_ROLES,
          regionClause,
        });
        if (regionHasApprover) {
          return jsonError(
            requesterRegion
              ? `Selected approver is not in your region (${requesterRegion}).`
              : "Selected approver is not in your region.",
            400,
          );
        }
      }

      approverId = String(customApprover._id);
      customApproverIsSeniorSecurity = isSeniorSecurityForCustom;
    }

    if (!approverId) {
      // Never the requester: another in-region HR, else an in-region admin, else
      // any company HR, else any company admin.
      approverId = await resolvePrimaryHrApprover({
        companyId,
        requesterId: userId,
        regionClause,
      });
    }

    if (!approverId) {
      return jsonError("No approver found to review this request.", 400);
    }

    // Junior security requests go to senior security (unless they already picked one)
    if (!customApproverIsSeniorSecurity) {
      const ssApproverId = await resolveSeniorSecurityApprover(userId, companyId, null);
      if (ssApproverId) {
        approverId = ssApproverId;
      }
    }

    // Advisory signatories: only what the requester nominated, nothing automatic.
    let plannedSignatories: SignatoryPlanEntry[] = [];
    try {
      const plan = await buildApproverPlan({
        requester,
        companyId,
        region: requesterRegion,
        regionClause,
        company: regionCompany,
        coApproverIds,
        teamOwnerId,
      });
      plannedSignatories = plan.signatories;
    } catch (error) {
      if (error instanceof RegionMismatchError) {
        return jsonError(
          error.region
            ? `${error.name_} is not in your region (${error.region}).`
            : `${error.name_} is not in your region.`,
          400,
        );
      }
      throw error;
    }

    // Only one pending document-letter per requester+company+letterType is
    // permitted by the unique index, so reuse (update) an existing pending
    // request of the SAME type instead of failing with a duplicate-key error.
    // A different letter type creates a separate pending request.
    const existing = await JoinRequest.findOne({
      requester: userId,
      company: companyId,
      kind: "document-letter",
      "metadata.letterType": letterType,
      status: "pending",
    });

    // The plan has already deduped nominees, so each person appears once. A
    // co-approver can sign before HR approves, so an edit-and-resubmit must not
    // silently un-sign them: a row that is still in the new plan and already
    // resolved keeps its status and timestamp, and only genuinely new nominees
    // start as pending.
    const priorSignatories = new Map(
      ((existing?.signatories as any[]) ?? []).map((entry) => [String(entry.user), entry]),
    );
    const signatories = plannedSignatories.map((entry) => {
      const prior = priorSignatories.get(String(entry.user));
      const resolved = prior && prior.status !== "pending";
      return {
        ...entry,
        status: (resolved ? prior.status : "pending") as "pending" | "signed" | "declined",
        signedAt: resolved ? (prior.signedAt ?? null) : null,
      };
    });

    const metadataRecord: Record<string, unknown> = {
      letterType,
      customType: letterType === "other" ? customType : "",
      purpose,
    };

    if (letterType === "internship") {
      const internshipStart = String(body.internshipStart ?? "").trim();
      const internshipEnd = String(body.internshipEnd ?? "").trim();
      metadataRecord.internshipStart = internshipStart;
      metadataRecord.internshipEnd = internshipEnd;
      metadataRecord.internshipStatus = "pending";
      metadataRecord.projectTitle = String(body.projectTitle ?? "").trim();
      metadataRecord.projectDescription = String(body.projectDescription ?? "").trim();
      metadataRecord.projectAchievements = String(body.projectAchievements ?? "").trim();

      const requesterWithTeam = await User.findById(userId)
        .populate({ path: "team", select: "name manager", populate: { path: "manager", select: "name role" } })
        .populate({ path: "activeTeams", select: "name manager", populate: { path: "manager", select: "name role" } })
        .lean();
      const team = (requesterWithTeam as any)?.team;
      if (team) {
        metadataRecord.teamName = team.name ?? "";
        metadataRecord.teamManagerName = (team.manager as any)?.name ?? "";
        metadataRecord.teamManagerRole = (team.manager as any)?.role ?? "";
      } else {
        const activeTeams = (requesterWithTeam as any)?.activeTeams ?? [];
        if (activeTeams.length > 0) {
          const firstTeam = activeTeams[0];
          metadataRecord.teamName = firstTeam.name ?? "";
          metadataRecord.teamManagerName = firstTeam.manager?.name ?? "";
          metadataRecord.teamManagerRole = firstTeam.manager?.role ?? "";
        }
      }
    }

    if (letterType === "resignation") {
      const resignationLastWorkingDay = String(body.resignationLastWorkingDay ?? "").trim();
      const companyDoc = await Company.findById(companyId).select("noticePeriodDays");
      metadataRecord.resignationLastWorkingDay = resignationLastWorkingDay;
      metadataRecord.noticePeriodDays = companyDoc?.noticePeriodDays ?? 30;
    }

    const letterContent = String(body.letterContent ?? "").trim();
    if (letterContent) {
      metadataRecord.letterContent = letterContent;
    }

    let joinRequest: Awaited<ReturnType<typeof JoinRequest.findOne>> | null = null;
    let letterId = "";
    if (existing) {
      existing.set("approver", approverId);
      // Re-submitting keeps any signature already collected (see above) and only
      // resets the letter's own primary signature.
      existing.set("signatories", signatories);
      existing.metadata = {
        ...metadataRecord,
        isSigned: false,
        signedBy: "",
        signedRole: "",
        signedAt: "",
      };
      existing.markModified("metadata");
      await existing.save();
      joinRequest = existing;
      letterId = String(existing._id);
    } else {
      const created = await JoinRequest.create({
        requester: userId,
        approver: approverId,
        company: companyId,
        kind: "document-letter",
        signatories,
        metadata: metadataRecord,
      });
      joinRequest = created;
      letterId = String(created._id);
    }

    if (!joinRequest) {
      return jsonError("Failed to create document letter request.", 500);
    }

    const startStr = String(body.internshipStart ?? "").trim();
    const endStr = String(body.internshipEnd ?? "").trim();
    const dateSuffix = startStr && endStr ? ` (${startStr} to ${endStr})` : "";
    const resignLastDay = String(body.resignationLastWorkingDay ?? "").trim();
    const resignSuffix = resignLastDay ? ` (Last day: ${resignLastDay})` : "";
    const notificationBody = `${String(requester.name ?? "A member")} has requested a ${letterType.replace("-", " ")} letter.${dateSuffix}${resignSuffix}`;

    // The primary approver decides whether the letter is issued. Signatories are
    // advisory, so they are told they may add their signature afterwards.
    await Notification.create({
      user: approverId,
      company: companyId,
      type: "approval",
      title: "Document Letter Request",
      message: notificationBody,
    });
    emitNotification(approverId);

    if (signatories.length > 0) {
      await Notification.create(
        signatories.map((entry) => ({
          user: entry.user,
          company: companyId,
          type: "info",
          title: "Optional signature requested",
          message: `${String(requester.name ?? "A member")} listed you to add an optional signature to a ${letterType.replace("-", " ")} letter. You can sign it now or after HR approves it — either way the letter is unaffected.`,
          // `draft=1` so the letter is readable straight away: it is not issued
          // yet, and the letter page refuses to render an unapproved letter
          // without it.
          link: `/letter/${letterId}?draft=1`,
        })),
      );
      for (const entry of signatories) {
        emitNotification(entry.user);
      }
    }

    return NextResponse.json({ request: joinRequest }, { status: existing ? 200 : 201 });
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
