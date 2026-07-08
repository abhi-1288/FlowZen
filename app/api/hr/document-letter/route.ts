import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";
import { resolveSeniorSecurityApprover } from "@/lib/join-approvers";

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

    const filter: Record<string, unknown> = {
      kind: "document-letter",
    };

    // scope=company returns all company docs for HR and Admin
    if (scope === "company" && (isHr || isAdmin) && actor.company) {
      filter.company = actor.company;
    } else if (isHr && actor.company) {
      filter.company = actor.company;
    } else {
      filter.requester = userId;
    }

    const requests = await JoinRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("requester", "name email role companyIdentityCode companyJoined pfNumber pfDeductionAmount esicNumber esicDeductionAmount")
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

    const validTypes = ["experience", "salary-certificate", "offer-letter", "relieving", "internship", "resignation", "other"];
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

    // Resolve approver: explicit HR → enrolling HR → fallback HR → fallback admin
    const companyId = String(requester.company);

    let approverId: string | null = null;
    let customApproverIsSeniorSecurity = false;

    if (customApproverId) {
      const customApprover = await User.findById(customApproverId).select("role company companyStatus isSeniorSecurity");
      const isSeniorSecurityForCustom = String(customApprover?.role) === "security" && Boolean((customApprover as any)?.isSeniorSecurity);
      const isJuniorRequester = String(requester.role) === "security" && !Boolean((requester as any).isSeniorSecurity);

      const validRole = isJuniorRequester
        ? ["human-resource", "admin"].includes(String(customApprover?.role)) || isSeniorSecurityForCustom
        : ["human-resource", "admin"].includes(String(customApprover?.role));

      if (
        !customApprover ||
        String(customApprover.company) !== companyId ||
        customApprover.companyStatus !== "approved" ||
        !validRole
      ) {
        return jsonError("Selected approver is not a valid HR or admin in your company.", 400);
      }
      approverId = String(customApprover._id);
      customApproverIsSeniorSecurity = isSeniorSecurityForCustom;
    }

    if (!approverId) {
      const enrollingHr = await resolveEnrollingHr(requester);
      approverId = enrollingHr?.id ?? null;
    }

    if (!approverId) {
      const fallbackHr = await User.findOne({
        company: companyId,
        role: "human-resource",
        companyStatus: "approved",
      })
        .select("_id")
        .sort({ createdAt: 1 })
        .lean() as { _id: string } | null;
      if (fallbackHr) {
        approverId = String(fallbackHr._id);
      }
    }

    if (!approverId) {
      const fallbackAdmin = await User.findOne({
        company: companyId,
        role: "admin",
        companyStatus: "approved",
      })
        .select("_id")
        .sort({ createdAt: 1 })
        .lean() as { _id: string } | null;
      if (fallbackAdmin) {
        approverId = String(fallbackAdmin._id);
      }
    }

    if (!approverId) {
      return jsonError("No HR or admin found to approve this request.", 400);
    }

    // Junior security requests go to senior security (unless they already picked one)
    if (!customApproverIsSeniorSecurity) {
      const ssApproverId = await resolveSeniorSecurityApprover(userId, companyId, null);
      if (ssApproverId) {
        approverId = ssApproverId;
      }
    }

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

    const joinRequest = await JoinRequest.create({
      requester: userId,
      approver: approverId,
      company: companyId,
      kind: "document-letter",
      metadata: metadataRecord,
    });

    const notificationTitle = "Document Letter Request";
    const startStr = String(body.internshipStart ?? "").trim();
    const endStr = String(body.internshipEnd ?? "").trim();
    const dateSuffix = startStr && endStr ? ` (${startStr} to ${endStr})` : "";
    const resignLastDay = String(body.resignationLastWorkingDay ?? "").trim();
    const resignSuffix = resignLastDay ? ` (Last day: ${resignLastDay})` : "";
    const notificationBody = `${String(requester.name ?? "A member")} has requested a ${letterType.replace("-", " ")} letter.${dateSuffix}${resignSuffix}`;

    await Notification.create({
      user: approverId,
      company: companyId,
      type: "approval",
      title: notificationTitle,
      message: notificationBody,
    });
    emitNotification(approverId);

    return NextResponse.json({ request: joinRequest }, { status: 201 });
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
