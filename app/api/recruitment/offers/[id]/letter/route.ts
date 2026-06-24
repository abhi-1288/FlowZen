import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSOffer } from "@/models/ATSOffer";
import { Company } from "@/models/Company";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";

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
    .populate("job", "title department");

  if (!offer) return jsonError("Offer not found.", 404);

  const company = await Company.findById(user.company);
  const companyName = company?.name || "Company";
  const companyIcon = company?.icon || "";

  const policy = await CompanyPolicy.findOne({ company: user.company });
  const foodAmt = policy ? Number(policy.foodAmount || 0) * 12 : 0;
  const travelAmt = policy ? Number(policy.travelAccommodationAmount || 0) * 12 : 0;

  const candidate = offer.candidate as any;
  const job = offer.job as any;

  const pfAmt = Number(offer.pfAmount || 0);
  const esicAmt = Number(offer.esicAmount || 0);
  const netTakeHome = Number(offer.offeredCTC) - pfAmt - esicAmt - foodAmt - travelAmt;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1e293b; }
  .header { text-align: center; margin-bottom: 32px; }
  .header h2 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; }
  .header .divider { margin: 12px auto 0; width: 80px; height: 3px; background: #4f46e5; }
  .header .logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }
  h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  .details { margin: 24px 0; }
  .details p { margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { background: #f8fafc; font-weight: 600; font-size: 14px; }
  td { font-size: 14px; }
  .total { font-weight: 700; }
  .deduction { color: #dc2626; }
  .net { color: #059669; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
  .perks { margin-top: 16px; padding: 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #92400e; }
  .perks h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #a16207; }
  .perks p { margin: 0; }
</style></head>
<body>
  <div class="header">
    <div class="logo">
      ${companyIcon ? `<img src="${companyIcon}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" />` : ""}
      <h2>${companyName}</h2>
    </div>
    <div class="divider"></div>
  </div>

  <h1>Offer Letter</h1>
  <p>Dear ${candidate.firstName} ${candidate.lastName},</p>
  <p>We are pleased to offer you the position of <strong>${offer.designation}</strong> at ${companyName}.</p>
  <div class="details">
    <p><strong>Department:</strong> ${offer.department || job?.department || "N/A"}</p>
    <p><strong>Designation:</strong> ${offer.designation}</p>
    ${offer.officeLocation ? `<p><strong>Office Location:</strong> ${offer.officeLocation}</p>` : ""}
    ${offer.joiningDate ? `<p><strong>Joining Date:</strong> ${new Date(offer.joiningDate).toLocaleDateString()}</p>` : ""}
    <p><strong>Email:</strong> ${candidate.email}</p>
    ${candidate.phone ? `<p><strong>Phone:</strong> ${candidate.phone}</p>` : ""}
  </div>

  <h3>Compensation Summary (Per Annum)</h3>
  <table>
    <tr><th>Component</th><th>Amount (₹/year)</th></tr>
    <tr><td>Gross CTC</td><td>₹${Number(offer.offeredCTC).toLocaleString()}</td></tr>
    ${pfAmt > 0 ? `<tr><td>PF Deduction</td><td class="deduction">- ₹${pfAmt.toLocaleString()}</td></tr>` : ""}
    ${esicAmt > 0 ? `<tr><td>ESIC Deduction</td><td class="deduction">- ₹${esicAmt.toLocaleString()}</td></tr>` : ""}
    ${foodAmt > 0 ? `<tr><td>Food Accommodation</td><td class="deduction">- ₹${foodAmt.toLocaleString()}</td></tr>` : ""}
    ${travelAmt > 0 ? `<tr><td>Travel Accommodation</td><td class="deduction">- ₹${travelAmt.toLocaleString()}</td></tr>` : ""}
    <tr class="total"><td>Net Take-Home (Approx)</td><td class="net">₹${netTakeHome.toLocaleString()}</td></tr>
  </table>

  ${offer.perks ? `<div class="perks"><h4>Travel &amp; Food Accommodation</h4><p>${offer.perks}</p></div>` : ""}

  <p>We look forward to having you on board!</p>
  <div class="footer">
    <p>This is a system-generated offer letter.</p>
  </div>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="offer-letter-${id}.html"`,
    },
  });
}
