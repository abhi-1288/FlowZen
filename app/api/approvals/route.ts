import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { listApprovedHrUserIds, findApprovedApproverIdForRequester, requesterRegionScope } from "@/lib/join-approvers";
import { DOCUMENT_LETTER_APPROVER_ROLES, effectiveRegionLabelOf, isUserInEffectiveRegion } from "@/lib/company-regions";

type RequestDoc = Record<string, any>;

function serializeApproval(request: RequestDoc, related: {
  users: Map<string, RequestDoc>;
  companies: Map<string, RequestDoc>;
  teams: Map<string, RequestDoc>;
}) {
  const id = String(request._id);
  const requesterId = String(request.requester ?? "");
  const companyId = String(request.company ?? "");
  const teamId = request.team ? String(request.team) : "";
  const replacementHrId = request.replacementHr ? String(request.replacementHr) : "";
  const replacementUserId = request.replacementUser ? String(request.replacementUser) : "";

  const serialized: RequestDoc = {
    ...request,
    id,
    requester: related.users.get(requesterId) ?? request.requester,
    company: related.companies.get(companyId) ?? request.company,
    team: teamId ? related.teams.get(teamId) ?? request.team : null,
    replacementHr: replacementHrId ? related.users.get(replacementHrId) ?? request.replacementHr : null,
    replacementUser: replacementUserId ? related.users.get(replacementUserId) ?? request.replacementUser : null,
  };

  delete serialized._id;
  delete serialized.__v;
  return serialized;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();

    const actor = await User.findById(userId).select("role company companyStatus regionLabel");
    if (!actor) return jsonError("User not found.", 404);

    const directRequests = await JoinRequest.find({ 
      approver: userId, 
      status: { $in: ["pending", "hr-approved"] } 
    })
      .sort({ createdAt: -1 })
      .lean();

    let requests = [...directRequests];

    if (String(actor.role) === "admin" && actor.company) {
      const companyPendingRequests = await JoinRequest.find({
        company: actor.company,
        kind: { $in: ["company", "identity-code", "identity-code-range", "quit-company", "quit-company-board-transfer", "role-transfer", "region-address", "employment-type"] },
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .lean();

      const requesterIds = companyPendingRequests
        .map((request) => request.requester)
        .filter(Boolean);
      const requesters = await User.find({ _id: { $in: requesterIds } })
        .select("name email role regionLabel")
        .lean();
      const rolesByUserId = new Map(requesters.map((requester) => [String(requester._id), String(requester.role ?? "")]));
      const requesterById = new Map(
        requesters.map((requester) => [String(requester._id), requester as RequestDoc]),
      );

      // Region scope: a regional admin only sees requests from requesters in
      // their own region. The company owner keeps the company-wide view, and a
      // company with no region config is unaffected.
      const adminCompany = await Company.findById(actor.company)
        .select("owner addresses address")
        .lean() as RequestDoc | null;
      const ownerId = adminCompany?.owner ?? null;
      const isOwner = ownerId != null && String(ownerId) === String(actor._id);
      const adminRegion = effectiveRegionLabelOf(adminCompany, actor);
      const scopeAdminToRegion = Boolean(adminRegion) && !isOwner;

      const adminVisibleRequests = companyPendingRequests.filter((request) => {
        const requesterRole = rolesByUserId.get(String(request.requester ?? ""));
        let roleVisible;
        if (["quit-company-board-transfer", "role-transfer"].includes(String(request.kind))) {
          roleVisible = true;
        } else if (String(request.kind) === "identity-code") {
          roleVisible = requesterRole === "human-resource";
        } else {
          roleVisible = requesterRole === "admin" || requesterRole === "human-resource";
        }
        if (!roleVisible) return false;
        if (!scopeAdminToRegion) return true;
        const requester = requesterById.get(String(request.requester ?? ""));
        return isUserInEffectiveRegion(adminCompany, adminRegion, requester);
      });

      requests = [...requests, ...adminVisibleRequests].filter((request, index, all) => {
        const id = String(request._id);
        return all.findIndex((r) => String(r._id) === id) === index;
      });
    }

    if (
      String(actor.role) === "human-resource" &&
      String(actor.companyStatus) === "approved" &&
      actor.company
    ) {
      const hrCompanyRequests = await JoinRequest.find({
        company: actor.company,
        kind: { $in: ["quit-company", "document-letter"] },
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .lean();

      const requesterIds = hrCompanyRequests
        .map((request) => request.requester)
        .filter(Boolean);
      const requesters = await User.find({ _id: { $in: requesterIds } })
        .select("name email role regionLabel")
        .lean();
      const requesterById = new Map(
        requesters.map((requester) => [String(requester._id), requester as RequestDoc]),
      );

      // Document letters are region-scoped: an HR only sees letters from their
      // own region (falling back to the company-wide list if the region has no
      // approver at all). `quit-company` is unaffected.
      const { region: hrRegion, clause: regionClause, company: regionCompany } =
        await requesterRegionScope(actor.company, actor);
      const regionHasLetterApprover = regionClause
        ? await findApprovedApproverIdForRequester({
            companyId: String(actor.company),
            roles: DOCUMENT_LETTER_APPROVER_ROLES,
            regionClause,
          })
        : null;
      const scopeLettersToRegion = Boolean(regionClause) && Boolean(regionHasLetterApprover);

      const visibleHrRequests = hrCompanyRequests.filter((request) => {
        const requester = requesterById.get(String(request.requester ?? ""));
        if (String(requester?.role ?? "") === "human-resource") return false;
        if (String(request.kind) === "document-letter" && scopeLettersToRegion) {
          return isUserInEffectiveRegion(regionCompany, hrRegion, requester);
        }
        return true;
      });

      requests = [...directRequests, ...visibleHrRequests]
        .filter((request, index, all) => {
          const id = String(request._id);
          return all.findIndex((r) => String(r._id) === id) === index;
        });
    }

    const identityRequests = requests.filter(
      (request) => String(request.kind) === "identity-code",
    );
    if (identityRequests.length > 0) {
      const identityRequesterIds = identityRequests
        .map((request) => request.requester)
        .filter(Boolean);
      const identityRequesters = await User.find({
        _id: { $in: identityRequesterIds },
      })
        .select("companyIdentityCode")
        .lean();
      const issuedRequesterIds = new Set(
        identityRequesters
          .filter((requester) =>
            String((requester as any).companyIdentityCode ?? "").trim(),
          )
          .map((requester) => String(requester._id)),
      );
      const issuedRequestIds = identityRequests
        .filter((request) => issuedRequesterIds.has(String(request.requester)))
        .map((request) => request._id);

      if (issuedRequestIds.length > 0) {
        await JoinRequest.updateMany(
          { _id: { $in: issuedRequestIds }, status: "pending" },
          { $set: { status: "approved" } },
        );
        requests = requests.filter(
          (request) => !issuedRequestIds.some((id) => String(id) === String(request._id)),
        );
      }
    }

    // Letters this user is listed to co-sign. A nominated signatory is listed as
    // soon as the request is made, not only once it is issued, otherwise the
    // "you may sign later" notification points at nothing and the letter is
    // invisible until HR acts. Signing is also open before issuance, so
    // `signatureReady` is not an access gate — it only says whether the letter
    // page needs `?draft=1` to render at all.
    const signatureRequests = await JoinRequest.find({
      kind: "document-letter",
      // A rejected letter never collects signatures.
      status: { $in: ["pending", "hr-approved", "approved"] },
      signatories: { $elemMatch: { user: userId, status: "pending" } },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (signatureRequests.length > 0) {
      // No slot is needed: the PATCH matches the caller by user id.
      const decorated = signatureRequests.map((request) => ({
        ...request,
        signatoryView: true,
        signatureReady: String(request.status) === "approved",
      }));
      requests = [...requests, ...decorated].filter((request, index, all) => {
        const id = String(request._id);
        return all.findIndex((r) => String(r._id) === id) === index;
      });
    }

    for (const request of requests) {
      if (!String(request.kind).startsWith("quit-")) continue;
      if (request.noticeEndedNotifiedAt) continue;
      const company = await Company.findById(request.company).select("noticePeriodDays").lean() as RequestDoc | null;
      const noticeDays = Number(company?.noticePeriodDays ?? 0);
      if (!Number.isFinite(noticeDays) || noticeDays <= 0) continue;
      const elapsedDays = Math.max(
        0,
        Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      );
      if (elapsedDays < noticeDays) continue;

      const requester = await User.findById(request.requester).select("name role").lean() as RequestDoc | null;
      const requesterName = String(requester?.name ?? "User");
      const requesterRole = String(requester?.role ?? "member");
      const message = `${requesterName}: ${requesterRole} has ended the notice period of ${noticeDays} days, clear them!`;

      let recipientIds: string[] = [String(request.approver)];
      if (request.kind === "quit-company" && ["project-manager", "qa-tester", "employee", "others"].includes(requesterRole)) {
        const companyId = (request.company as any)?._id ?? request.company;
        recipientIds = await listApprovedHrUserIds(companyId);
      }
      recipientIds = Array.from(new Set(recipientIds.filter(Boolean)));
      if (recipientIds.length > 0) {
        await Notification.insertMany(
          recipientIds.map((recipient) => ({
            user: recipient,
            company: request.company,
            team: request.team,
            type: "approval",
            title: "Notice period completed",
            message,
          })),
        );
        recipientIds.forEach((id) => emitNotification(String(id)));
        await JoinRequest.updateOne({ _id: request._id }, { $set: { noticeEndedNotifiedAt: new Date() } });
        (request as any).noticeEndedNotifiedAt = new Date();
      }
    }

    const userIds = new Set<string>();
    const companyIds = new Set<string>();
    const teamIds = new Set<string>();
    requests.forEach((request) => {
      if (request.requester) userIds.add(String(request.requester));
      if (request.replacementHr) userIds.add(String(request.replacementHr));
      if (request.replacementUser) userIds.add(String(request.replacementUser));
      if (request.company) companyIds.add(String(request.company));
      if (request.team) teamIds.add(String(request.team));
    });

    const [users, companies, teams] = await Promise.all([
      User.find({ _id: { $in: [...userIds] } }).select("name email role phone avatarUrl bloodGroup emergencyContact regionLabel companyIdentityCode companyJoined createdAt").lean(),
      Company.find({ _id: { $in: [...companyIds] } }).select("name joinCode noticePeriodDays primaryColor icon status supportEmail website address addresses multiOffice").lean(),
      Team.find({ _id: { $in: [...teamIds] } }).select("name joinCode").lean(),
    ]);

    const related = {
      users: new Map(users.map((user) => [String(user._id), { ...user, id: String(user._id) }])),
      companies: new Map(companies.map((company) => [String(company._id), { ...company, id: String(company._id) }])),
      teams: new Map(teams.map((team) => [String(team._id), { ...team, id: String(team._id) }])),
    };

    return NextResponse.json({ requests: requests.map((request) => serializeApproval(request, related)) });
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
