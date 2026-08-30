import { createHash, randomBytes } from "crypto";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { createMagicLinkToken } from "@/lib/codes";

const PASS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createGuestPassCode(length = 6): string {
  let code = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += PASS_ALPHABET[bytes[i] % PASS_ALPHABET.length];
  }
  return `FLOWZ-${code}`;
}

/**
 * Generates a unique, collision-free guest pass code for an in-person interview
 * scoped to the given company.
 */
export async function createUniqueGuestPassCode(companyId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = createGuestPassCode();
    const existing = await ATSInterview.findOne({ company: companyId, passCode: code }).select("_id").lean();
    if (!existing) return code;
  }
  return createGuestPassCode();
}

/**
 * Finds an in-person candidate interview by its scannable guest pass code,
 * scoped to the given company.
 */
export async function findInterviewPassByCode(companyId: string, code: string) {
  const interview = await ATSInterview.findOne({
    company: companyId,
    passCode: { $regex: new RegExp(`^${code}$`, "i") },
    location: { $ne: "" },
  })
    .populate("candidate", "firstName lastName email")
    .populate("job", "title")
    .populate("interviewer", "name");
  if (!interview) return null;
  return interview;
}

export function buildOrigin(request: Request): string {
  const urlOrigin = new URL(request.url).origin;
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development" ? urlOrigin : "") ||
    process.env.NEXTAUTH_URL ||
    urlOrigin ||
    "http://localhost:3000"
  );
}

/**
 * Finds a candidate whose portal token (primary magic token or secondary portal
 * token) matches the given raw token and is still valid.
 */
export async function findCandidateByToken(token: string, fields = "") {
  const hash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const candidate = await ATSCandidate.findOne({
    $or: [
      { magicTokenHash: hash, magicTokenExpiresAt: { $gt: now } },
      { portalTokenHash: hash, portalTokenExpiresAt: { $gt: now } },
    ],
  });
  if (!candidate) return null;
  return fields ? await ATSCandidate.findById(candidate._id).select(fields) : candidate;
}

export function buildPortalLink(origin: string, token: string | undefined): string | undefined {
  if (!token) return undefined;
  return `${origin}/candidate-portal?token=${encodeURIComponent(token)}`;
}

/**
 * Returns the raw portal token for a candidate.
 *
 * - If a raw token is already stored, it is returned as-is (stable, never rotated).
 * - Otherwise a fresh token is generated. When the original apply-link token is
 *   still valid, its hash is left untouched and the new token is stored under a
 *   separate secondary hash so both links keep working. When the original token
 *   is expired or absent, the new token replaces it entirely.
 *
 * Returns undefined when no usable token can be produced.
 */
export async function resolveCandidatePortalToken(candidateId: string): Promise<string | undefined> {
  const candidate: any = await ATSCandidate.findById(candidateId).select(
    "+magicTokenHash magicTokenExpiresAt +portalTokenHash portalTokenExpiresAt portalAccessToken"
  );
  if (!candidate) return undefined;

  if (candidate.portalAccessToken) return candidate.portalAccessToken;

  const originValid =
    candidate.magicTokenHash &&
    (!candidate.magicTokenExpiresAt || new Date(candidate.magicTokenExpiresAt).getTime() > Date.now());

  const token = createMagicLinkToken();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  if (originValid) {
    await ATSCandidate.findByIdAndUpdate(candidateId, {
      portalAccessToken: token,
      portalTokenHash: tokenHash,
      portalTokenExpiresAt: expiresAt,
    });
  } else {
    await ATSCandidate.findByIdAndUpdate(candidateId, {
      portalAccessToken: token,
      portalTokenHash: tokenHash,
      portalTokenExpiresAt: expiresAt,
      magicTokenHash: tokenHash,
      magicTokenExpiresAt: expiresAt,
    });
  }

  return token;
}
