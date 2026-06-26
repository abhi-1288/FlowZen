import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSOffer } from "@/models/ATSOffer";
import { Company } from "@/models/Company";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { renderRecruitmentOfferLetterHtml } from "@/lib/recruitment-offer-letter";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid offer id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const offer = await ATSOffer.findOne({ _id: id, company: user.company })
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title department")
    .populate("signedBy", "name role");

  if (!offer) return jsonError("Offer not found.", 404);

  const company = await Company.findById(user.company).select("name icon");
  const policy = await CompanyPolicy.findOne({ company: user.company });
  const html = renderRecruitmentOfferLetterHtml({
    offer,
    candidate: offer.candidate as any,
    job: offer.job as any,
    company: company as any,
    policy,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="offer-letter-${id}.html"`,
    },
  });
}
