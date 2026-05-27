import { JoinRequest } from "@/models/JoinRequest";
import { User } from "@/models/User";

export type EnrollingHr = { id: string; name: string };

export type JoinedByInfo = {
  name: string;
  role: string;
  viaHr: boolean;
};

function idString(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id?: unknown })._id ?? "");
  }
  return String(value);
}

async function inviterRecordAsHr(
  inviter: unknown,
  companyId: string,
): Promise<EnrollingHr | null> {
  if (!inviter) return null;

  if (typeof inviter === "object" && inviter !== null && "_id" in (inviter as object)) {
    const doc = inviter as { _id: unknown; name?: string; role?: string; company?: unknown; companyStatus?: string };
    if (String(doc.role ?? "") !== "human-resource") return null;
    if (idString(doc.company) !== companyId) return null;
    if (doc.companyStatus && doc.companyStatus !== "approved") return null;
    const name = String(doc.name ?? "").trim();
    if (!name) return null;
    return { id: String(doc._id), name };
  }

  const inviterId = String(inviter);
  if (!inviterId) return null;

  const hr = await User.findOne({
    _id: inviterId,
    company: companyId,
    role: "human-resource",
    companyStatus: "approved",
  }).select("name");
  if (!hr?.name) return null;
  return { id: inviterId, name: String(hr.name) };
}

export async function resolveEnrollingHr(user: {
  _id: unknown;
  company: unknown;
  membershipHistory?: { action?: string; company?: unknown; inviter?: unknown }[];
}): Promise<EnrollingHr | null> {
  const companyId = idString(user.company);
  if (!companyId) return null;

  const history = Array.isArray(user.membershipHistory) ? user.membershipHistory : [];
  const lastJoin = [...history]
    .reverse()
    .find(
      (entry) =>
        String(entry?.action ?? "") === "joined-company" &&
        idString(entry?.company) === companyId,
    );

  if (lastJoin?.inviter) {
    const fromHistory = await inviterRecordAsHr(lastJoin.inviter, companyId);
    if (fromHistory) return fromHistory;
  }

  const joinReq = await JoinRequest.findOne({
    requester: user._id,
    company: companyId,
    kind: "company",
    status: "approved",
  })
    .sort({ updatedAt: -1 })
    .select("approver metadata");

  if (!joinReq) return null;

  const meta = (joinReq.metadata ?? {}) as { enrollingHrId?: unknown };
  const metaHrId = meta.enrollingHrId ? String(meta.enrollingHrId) : "";
  if (metaHrId) {
    const hr = await User.findOne({
      _id: metaHrId,
      company: companyId,
      role: "human-resource",
      companyStatus: "approved",
    }).select("name");
    if (hr?.name) return { id: metaHrId, name: String(hr.name) };
  }

  return inviterRecordAsHr(joinReq.approver, companyId);
}

async function approverAsJoinedBy(
  approverId: unknown,
  companyId: string,
): Promise<JoinedByInfo | null> {
  if (!approverId) return null;
  const approver = await User.findById(approverId).select("name role company companyStatus");
  if (!approver?.name) return null;
  const viaHr = String(approver.role ?? "") === "human-resource";
  if (viaHr) {
    if (idString(approver.company) !== companyId) return null;
    if (approver.companyStatus && approver.companyStatus !== "approved") return null;
  }
  return {
    name: String(approver.name),
    role: String(approver.role ?? ""),
    viaHr,
  };
}

/** Best available enrollment contact for profile display (HR preferred). */
export async function resolveJoinedByInfo(user: {
  _id: unknown;
  company: unknown;
  membershipHistory?: { action?: string; company?: unknown; inviter?: unknown }[];
}): Promise<JoinedByInfo | null> {
  const companyId = idString(user.company);
  if (!companyId) return null;

  const enrollingHr = await resolveEnrollingHr(user);
  if (enrollingHr) {
    return { name: enrollingHr.name, role: "human-resource", viaHr: true };
  }

  const history = Array.isArray(user.membershipHistory) ? user.membershipHistory : [];
  const lastJoin = [...history]
    .reverse()
    .find(
      (entry) =>
        String(entry?.action ?? "") === "joined-company" &&
        idString(entry?.company) === companyId,
    );

  if (lastJoin?.inviter) {
    if (typeof lastJoin.inviter === "object" && lastJoin.inviter !== null && "name" in lastJoin.inviter) {
      const doc = lastJoin.inviter as { name?: string; role?: string };
      const name = String(doc.name ?? "").trim();
      if (name) {
        const viaHr = String(doc.role ?? "") === "human-resource";
        return { name, role: String(doc.role ?? ""), viaHr };
      }
    }
    const fromId = await approverAsJoinedBy(lastJoin.inviter, companyId);
    if (fromId) return fromId;
  }

  const joinReq = await JoinRequest.findOne({
    requester: user._id,
    company: companyId,
    kind: "company",
    status: "approved",
  })
    .sort({ updatedAt: -1 })
    .select("approver");

  if (joinReq?.approver) {
    return approverAsJoinedBy(joinReq.approver, companyId);
  }

  return null;
}
