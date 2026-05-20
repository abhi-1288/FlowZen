import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { listApprovedHrUserIds } from "@/lib/join-approvers";

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

    const actor = await User.findById(userId).select("role company companyStatus");
    if (!actor) return jsonError("User not found.", 404);

    const directRequests = await JoinRequest.find({ approver: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .lean();

    let requests = [...directRequests];

    if (String(actor.role) === "admin" && actor.company) {
      const companyPendingRequests = await JoinRequest.find({
        company: actor.company,
        kind: { $in: ["company", "quit-company"] },
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .lean();

      const requesterIds = companyPendingRequests
        .map((request) => request.requester)
        .filter(Boolean);
      const requesters = await User.find({ _id: { $in: requesterIds } })
        .select("name email role")
        .lean();
      const rolesByUserId = new Map(requesters.map((requester) => [String(requester._id), String(requester.role ?? "")]));

      const hrRequests = companyPendingRequests.filter(
        (request) => rolesByUserId.get(String(request.requester ?? "")) === "human-resource",
      );

      requests = [...requests, ...hrRequests].filter((request, index, all) => {
        const id = String(request._id);
        return all.findIndex((r) => String(r._id) === id) === index;
      });
    }

    if (
      String(actor.role) === "human-resource" &&
      String(actor.companyStatus) === "approved" &&
      actor.company
    ) {
      const hrQuitRequests = await JoinRequest.find({
        company: actor.company,
        kind: "quit-company",
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .lean();

      const requesterIds = hrQuitRequests
        .map((request) => request.requester)
        .filter(Boolean);
      const requesters = await User.find({ _id: { $in: requesterIds } })
        .select("name email role")
        .lean();
      const rolesByUserId = new Map(requesters.map((requester) => [String(requester._id), String(requester.role ?? "")]));

      requests = [...directRequests, ...hrQuitRequests.filter((request) => rolesByUserId.get(String(request.requester ?? "")) !== "human-resource")]
        .filter((request, index, all) => {
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
      User.find({ _id: { $in: [...userIds] } }).select("name email role").lean(),
      Company.find({ _id: { $in: [...companyIds] } }).select("name joinCode noticePeriodDays").lean(),
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
