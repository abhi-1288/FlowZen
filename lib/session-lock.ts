import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { isUserInEffectiveRegion, effectiveRegionLabelOf } from "@/lib/company-regions";
import { SessionLock } from "@/models/SessionLock";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { PinResetRequest } from "@/models/PinResetRequest";
import {
  computeLockState,
  computeLockout,
  lockoutSecondsRemaining,
  PIN_MAX_FAILED_ATTEMPTS,
  generateGreenPin,
  validatePin,
  isPinLength,
  type PinLength,
} from "@/lib/pin";
import { sendMail } from "@/lib/mailer";

export type PublicSessionState = {
  enabled: boolean;
  locked: boolean;
  length: number | null;
  lockoutUntil: number | null;
  failedAttempts: number;
};

export type UnlockResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      failedAttempts?: number;
      lockoutUntil?: number | null;
      retryAfter?: number;
    };

export type PinMutationResult =
  | { ok: true; length: number | null }
  | { ok: false; status: number; error: string };

export function requestIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

type SessionLockLike = {
  sessionId: string;
  user: unknown;
  pinEnabled?: boolean | null;
  pinLength?: number | null;
  pinVersion?: number | null;
  locked?: boolean | null;
  lockedAt?: Date | null;
  lastActiveAt?: Date | null;
  unlockedPinVersion?: number | null;
  unlockMethod?: string | null;
  failedAttempts?: number | null;
  lastFailedAt?: Date | null;
  lockoutUntil?: Date | null;
  save: () => Promise<unknown>;
};

function evaluateLocked(doc: SessionLockLike, now: number): boolean {
  return computeLockState({
    pinEnabled: Boolean(doc.pinEnabled),
    locked: Boolean(doc.locked),
    lastActiveAt: doc.lastActiveAt ? new Date(doc.lastActiveAt).getTime() : 0,
    now,
    unlockedPinVersion: Number(doc.unlockedPinVersion ?? 0),
    pinVersion: Number(doc.pinVersion ?? 0),
  });
}

/**
 * Fetch (or lazily create) the per-session lock record. A brand-new session is
 * treated as freshly authenticated — unlocked, tagged `unlockMethod: "login"`.
 */
export async function ensureSession(userId: string, sessionId: string): Promise<SessionLockLike> {
  await connectDb();

  const existing = (await SessionLock.findOne({ sessionId })) as unknown as SessionLockLike | null;
  if (existing) return existing;

  const user = await User.findById(userId).select("pinEnabled pinLength pinVersion");
  const pinEnabled = Boolean(user?.pinEnabled);
  const pinLength = (user?.pinLength as number | null | undefined) ?? null;
  const pinVersion = Number(user?.pinVersion ?? 0);
  const now = new Date();

  try {
    const created = (await SessionLock.findOneAndUpdate(
      { sessionId },
      {
        $setOnInsert: {
          sessionId,
          user: userId,
          pinEnabled,
          pinLength,
          pinVersion,
          unlockedPinVersion: pinVersion,
          locked: false,
          lastActiveAt: now,
          unlockMethod: "login",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )) as unknown as SessionLockLike | null;
    if (created) return created;
  } catch {
    // Concurrent create raced the unique index — fall through to a re-read.
  }

  const created = (await SessionLock.findOne({ sessionId })) as unknown as SessionLockLike | null;
  if (!created) throw new Error("Unable to initialise session lock record.");
  return created;
}

export async function getSessionState(userId: string, sessionId: string): Promise<PublicSessionState> {
  const doc = await ensureSession(userId, sessionId);
  const now = Date.now();
  const lockoutUntil = doc.lockoutUntil ? new Date(doc.lockoutUntil).getTime() : null;
  return {
    enabled: Boolean(doc.pinEnabled),
    locked: evaluateLocked(doc, now),
    length: doc.pinEnabled ? (doc.pinLength ?? null) : null,
    lockoutUntil: lockoutUntil && lockoutUntil > now ? lockoutUntil : null,
    failedAttempts: Number(doc.failedAttempts ?? 0),
  };
}

export async function isSessionLocked(userId: string, sessionId: string): Promise<boolean> {
  const doc = await ensureSession(userId, sessionId);
  return evaluateLocked(doc, Date.now());
}

export async function lockSession(userId: string, sessionId: string): Promise<void> {
  const doc = await ensureSession(userId, sessionId);
  if (!doc.pinEnabled) return;
  doc.locked = true;
  doc.lockedAt = new Date();
  await doc.save();
}

export async function heartbeatSession(userId: string, sessionId: string): Promise<PublicSessionState> {
  const doc = await ensureSession(userId, sessionId);
  const now = Date.now();
  if (!evaluateLocked(doc, now)) {
    doc.lastActiveAt = new Date(now);
    await doc.save();
  }
  return getSessionState(userId, sessionId);
}

export async function authenticateUnlock(
  userId: string,
  sessionId: string,
  pin: string,
): Promise<UnlockResult> {
  const doc = await ensureSession(userId, sessionId);
  const user = await User.findById(userId).select("+pinHash pinEnabled pinLength pinVersion");

  if (!user || !user.pinEnabled || !user.pinHash) {
    return { ok: false, status: 400, error: "PIN lock is not enabled for this account." };
  }

  const now = Date.now();
  const currentLockout = doc.lockoutUntil ? new Date(doc.lockoutUntil).getTime() : null;
  if (currentLockout && currentLockout > now) {
    return {
      ok: false,
      status: 429,
      error: "Too many incorrect attempts. Try again later.",
      retryAfter: lockoutSecondsRemaining(currentLockout, now),
      lockoutUntil: currentLockout,
    };
  }

  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) {
    doc.failedAttempts = Number(doc.failedAttempts ?? 0) + 1;
    doc.lastFailedAt = new Date();
    doc.locked = true;
    const nextLockout = computeLockout(Number(doc.failedAttempts), now, currentLockout);
    if (nextLockout) doc.lockoutUntil = new Date(nextLockout);
    await doc.save();
    const lockoutUntil = doc.lockoutUntil ? new Date(doc.lockoutUntil).getTime() : null;
    return {
      ok: false,
      status: 401,
      error:
        nextLockout && lockoutUntil && lockoutUntil > now
          ? "Too many incorrect attempts. Try again later."
          : "Incorrect PIN.",
      failedAttempts: Number(doc.failedAttempts ?? 0),
      lockoutUntil: lockoutUntil && lockoutUntil > now ? lockoutUntil : null,
      retryAfter: lockoutUntil ? lockoutSecondsRemaining(lockoutUntil, now) : undefined,
    };
  }

  const version = Number(user.pinVersion ?? 0);
  doc.locked = false;
  doc.lockedAt = null;
  doc.lastActiveAt = new Date(now);
  doc.unlockMethod = "pin";
  doc.pinEnabled = true;
  doc.pinLength = (user.pinLength as number | null | undefined) ?? doc.pinLength ?? null;
  doc.pinVersion = version;
  doc.unlockedPinVersion = version;
  doc.failedAttempts = 0;
  doc.lastFailedAt = null;
  doc.lockoutUntil = null;
  await doc.save();
  return { ok: true };
}

/**
 * Create or change the user's PIN, then sync every session so that sessions
 * holding the previous `pinVersion` relock. The session making the change is
 * kept unlocked against the new version.
 */
export async function setUserPin(
  userId: string,
  sessionId: string,
  pin: string,
  currentPin: string | null,
  length: PinLength,
): Promise<PinMutationResult> {
  await connectDb();
  const user = await User.findById(userId).select("+pinHash pinEnabled pinVersion");
  if (!user) return { ok: false, status: 404, error: "User not found." };

  if (user.pinEnabled) {
    if (!currentPin) return { ok: false, status: 400, error: "Enter your current PIN to change it." };
    const valid = await bcrypt.compare(currentPin, user.pinHash ?? "");
    if (!valid) return { ok: false, status: 401, error: "Current PIN is incorrect." };
  }

  const hash = await bcrypt.hash(pin, 12);
  const version = Number(user.pinVersion ?? 0) + 1;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        pinEnabled: true,
        pinHash: hash,
        pinLength: length,
        pinSetAt: new Date(),
        pinVersion: version,
      },
    },
  );

  await syncUserSessions(userId, {
    pinEnabled: true,
    pinLength: length,
    pinVersion: version,
    keepSessionId: sessionId,
  });
  return { ok: true, length };
}

export async function disableUserPin(
  userId: string,
  currentPin: string | null,
): Promise<PinMutationResult> {
  await connectDb();
  const user = await User.findById(userId).select("+pinHash pinEnabled pinVersion");
  if (!user) return { ok: false, status: 404, error: "User not found." };
  if (!user.pinEnabled) return { ok: true, length: null };

  if (!currentPin) return { ok: false, status: 400, error: "Enter your current PIN to disable it." };
  const valid = await bcrypt.compare(currentPin, user.pinHash ?? "");
  if (!valid) return { ok: false, status: 401, error: "Current PIN is incorrect." };

  const version = Number(user.pinVersion ?? 0) + 1;
  await User.updateOne(
    { _id: userId },
    {
      $unset: { pinHash: 1 },
      $set: { pinEnabled: false, pinLength: null, pinSetAt: null, pinVersion: version },
    },
  );
  await syncUserSessions(userId, {
    pinEnabled: false,
    pinLength: null,
    pinVersion: version,
    keepSessionId: null,
  });
  return { ok: true, length: null };
}

async function syncUserSessions(
  userId: string,
  opts: {
    pinEnabled: boolean;
    pinLength: number | null;
    pinVersion: number;
    keepSessionId: string | null;
  },
): Promise<void> {
  await connectDb();
  await SessionLock.updateMany(
    { user: userId },
    { $set: { pinEnabled: opts.pinEnabled, pinLength: opts.pinLength, pinVersion: opts.pinVersion } },
  );
  if (opts.keepSessionId) {
    await SessionLock.updateOne(
      { sessionId: opts.keepSessionId, user: userId },
      {
        $set: {
          unlockedPinVersion: opts.pinVersion,
          locked: false,
          lockedAt: null,
          lastActiveAt: new Date(),
        },
      },
    );
  }
}

/**
 * Public summary of a pending (or recent) Green PIN reset request for a HR
 * dashboard. No PIN material is ever included.
 */
export type GreenPinResetRequestSummary = {
  id: string;
  status: string;
  region: string;
  reason: string;
  createdAt: string;
  requester: { id: string; name: string; email: string; region: string };
  resolvedBy?: { id: string; name: string; email: string } | null;
  fulfilledAt?: string | null;
  resolutionMethod?: string | null;
};

/**
 * Atomically apply a new PIN to a user without needing their current PIN, while
 * bumping every other session's lock state through `pinVersion`.
 */
export async function forceSetUserPin(
  userId: string,
  pin: string,
  length: PinLength,
): Promise<void> {
  await connectDb();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  const hash = await bcrypt.hash(pin, 12);
  const version = Number((user as any).pinVersion ?? 0) + 1;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        pinEnabled: true,
        pinHash: hash,
        pinLength: length,
        pinSetAt: new Date(),
        pinVersion: version,
      },
      $unset: { lastGreenPinResetError: "" },
    },
  );

  await syncUserSessions(userId, {
    pinEnabled: true,
    pinLength: length,
    pinVersion: version,
    keepSessionId: null,
  });
}

/**
 * Open a recovery request in the user's effective region. Existing requests are
 * reused so a lost device cannot flood a region's HR inbox.
 */
export async function createGreenPinResetRequest(
  userId: string,
  reason: string,
): Promise<{
  requestId: string;
  region: string;
  hrContacts: { id: string; name: string; email: string }[];
  reused: boolean;
  emailSent: boolean;
}> {
  await connectDb();
  const user = await User.findById(userId);
  if (!user || !(user as any).company) {
    throw new Error("No company found.");
  }
  const company = await Company.findById((user as any).company).lean();
  const region = effectiveRegionLabelOf(company as any, user as any);

  const companyForHr = await Company.findById((user as any).company).lean();
  const candidates = await findRegionalHrs(companyForHr, (user as any).company, region);  const existing = await PinResetRequest.findOne({
    user: userId,
    company: (user as any).company,
    status: "pending",
  }).sort({ createdAt: -1 });

  const request =
    existing ||
    (await PinResetRequest.create({
      user: (user as any)._id,
      company: (user as any).company,
      region,
      requestedBy: (user as any)._id,
      reason,
      status: "pending",
    }));

  const hrs = candidates.map((hr) => ({
    id: String(hr._id),
    name: String(hr.name ?? ""),
    email: String(hr.email ?? ""),
  }));

  let emailSent = false;
  if (hrs.length) {
    const subject = `Green PIN reset request${region ? ` (${region})` : ""}`;
    const text = [
      `A Green PIN reset request has been opened by ${String((user as any).name ?? "")}.`,
      region ? `Region: ${region}` : "",
      String((user as any).email ?? "") ? `Member email: ${String((user as any).email ?? "")}` : "",
      reason ? `Reason: ${reason}` : "",
      "",
      "Open FlowZen and approve or reject this request under Profile → Security.",
    ]
      .filter(Boolean)
      .join("\\n");

    const results = await Promise.allSettled(
      hrs.map((hr) =>
        hr.email
          ? sendMail({ to: hr.email, subject, text })
          : Promise.resolve(undefined),
      ),
    );
    emailSent = results.some((result) => result.status === "fulfilled");
  }

  return {
    requestId: String((request as any)._id),
    region,
    hrContacts: hrs,
    reused: Boolean(existing),
    emailSent,
  };
}

export async function listPendingGreenPinResetRequests(
  hrId: string,
): Promise<GreenPinResetRequestSummary[]> {
  await connectDb();
  const hr = await User.findById(hrId);
  if (!hr || !(hr as any).company || String((hr as any).role) !== "human-resource") {
    throw new Error("Regional HR access required.");
  }
  const company = await Company.findById((hr as any).company).lean();
  const requests = await PinResetRequest.find({
    company: (hr as any).company,
    status: "pending",
  })
    .populate("user", "name email regionLabel")
    .populate("requestedBy", "name email regionLabel")
    .sort({ createdAt: -1 });

  return requests
    .filter((request: any) => {
      const targetRegion = request.region || effectiveRegionLabelOf(company as any, request.user as any);
      return isUserInEffectiveRegion(company as any, targetRegion, hr as any);
    })
    .map((request: any) => ({
      id: String(request._id),
      status: String(request.status),
      region: String(request.region ?? ""),
      reason: String(request.reason ?? ""),
      createdAt: request.createdAt ? new Date(request.createdAt).toISOString() : "",
      requester: {
        id: String(request.user?._id ?? request.user),
        name: String(request.user?.name ?? ""),
        email: String(request.user?.email ?? ""),
        region: effectiveRegionLabelOf(company as any, request.user as any),
      },
      resolvedBy: null,
      fulfilledAt: null,
      resolutionMethod: null,
    }));
}

export async function fulfillGreenPinResetRequest(
  requestId: string,
  hrId: string,
  params: { pin?: string | null; length?: number | null; generate?: boolean },
): Promise<{ requestId: string; length: number; pin: string; emailSent: boolean; targetEmail: string }> {
  await connectDb();
  const request: any = await PinResetRequest.findById(requestId);
  if (!request || request.status !== "pending") {
    throw new Error("Pending recovery request not found.");
  }

  const hr: any = await User.findById(hrId);
  const target: any = await User.findById(request.user);
  if (!hr || !target) throw new Error("Request participants not found.");
  if ((hr as any).company?.toString() !== (target as any).company?.toString()) {
    throw new Error("Regional HR access required.");
  }
  if (String((hr as any).role) !== "human-resource") {
    throw new Error("Regional HR access required.");
  }

  const company = await Company.findById((target as any).company).lean();
  const targetRegion = request.region || effectiveRegionLabelOf(company as any, target as any);
  if (!isUserInEffectiveRegion(company as any, targetRegion, hr as any)) {
    throw new Error("Regional HR access required.");
  }

  const rawLength = isPinLength(params.length) ? params.length : isPinLength(target.pinLength) ? (target.pinLength as PinLength) : 6;
  const length: PinLength = isPinLength(rawLength) ? rawLength : 6;

  let pin = "";
  const wantsGenerate = Boolean(params.generate) || !params.pin;
  if (wantsGenerate) {
    pin = generateGreenPin(length);
  } else {
    const validation = validatePin(params.pin, length);
    if (!validation.ok) throw new Error(validation.error);
    pin = validation.pin;
  }

  await forceSetUserPin(String((target as any)._id), pin, length);

  await PinResetRequest.updateOne(
    { _id: requestId },
    {
      $set: {
        status: "fulfilled",
        region: targetRegion,
        resolvedBy: (hr as any)._id,
        fulfilledAt: new Date(),
        resolutionMethod: wantsGenerate ? "generated" : "manual",
      },
    },
  );

  let emailSent = false;
  if (target.email) {
    try {
      await sendMail({
        to: String(target.email),
        subject: "Your Green PIN was reset",
        text: [
          `A Green PIN reset was approved by ${String((hr as any).name ?? "regional HR")}.`,
          `Your new ${length}-digit Green PIN is: ${pin}`,
          "Open FlowZen and use it to unlock, then choose your own Green PIN in Profile > Security.",
        ].join("\\n"),
      });
      emailSent = true;
    } catch {
      emailSent = false;
    }
  }

  return {
    requestId: String(request._id),
    length,
    pin,
    emailSent,
    targetEmail: String(target.email ?? ""),
  };
}

export async function cancelGreenPinResetRequest(requestId: string, hrId: string): Promise<void> {
  await connectDb();
  const request: any = await PinResetRequest.findById(requestId);
  if (!request || request.status !== "pending") {
    throw new Error("Pending recovery request not found.");
  }
  const hr: any = await User.findById(hrId);
  const target: any = await User.findById(request.user);
  if (!hr || !target || String((hr as any).company) !== String((target as any).company)) {
    throw new Error("Regional HR access required.");
  }
  const company = await Company.findById((target as any).company).lean();
  const targetRegion = request.region || effectiveRegionLabelOf(company as any, target as any);
  if (!isUserInEffectiveRegion(company as any, targetRegion, hr as any)) {
    throw new Error("Regional HR access required.");
  }
  await PinResetRequest.updateOne(
    { _id: requestId },
    { $set: { status: "cancelled", resolvedBy: (hr as any)._id, fulfilledAt: new Date() } },
  );
}

async function findRegionalHrs(company: any, companyId: unknown, region: string) {
  const all = await User.find({
    company: companyId,
    role: "human-resource",
    companyStatus: "approved",
  }).select("_id name email regionLabel");
  const scoped = all.filter((hr) => isUserInEffectiveRegion(company, region, hr as any));
  if (scoped.length) return scoped;
  return all;
}

export { PIN_MAX_FAILED_ATTEMPTS };
