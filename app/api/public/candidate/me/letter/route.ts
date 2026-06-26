import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { jsonError } from "@/lib/api";
import { renderRecruitmentOfferLetterHtml } from "@/lib/recruitment-offer-letter";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  const hash = createHash("sha256").update(token).digest("hex");

  await connectDb();

  const candidate = await ATSCandidate.findOne({
    magicTokenHash: hash,
    magicTokenExpiresAt: { $gt: new Date() },
  });

  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const offer = await ATSOffer.findOne({ candidate: candidate._id, company: candidate.company })
    .sort({ createdAt: -1 })
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title department")
    .populate("company", "name icon")
    .populate("signedBy", "name role");

  if (!offer) return jsonError("No offer found for this candidate.", 404);

  const policy = await CompanyPolicy.findOne({ company: candidate.company });
  const html = renderRecruitmentOfferLetterHtml({
    offer,
    candidate: offer.candidate as any,
    job: offer.job as any,
    company: offer.company as any,
    policy,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="offer-letter.html"`,
    },
  });
}
