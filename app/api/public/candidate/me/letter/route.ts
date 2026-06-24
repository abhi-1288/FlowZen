import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { jsonError } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  const hash = createHash("sha256").update(token).digest("hex");

  await connectDb();

  const candidate = await ATSCandidate.findOne({
    magicTokenHash: hash,
    magicTokenExpiresAt: { $gt: new Date() },
  })
    .populate("job", "title department")
    .populate("company", "name icon");

  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const offer = await ATSOffer.findOne({ candidate: candidate._id, company: candidate.company })
    .populate("candidate", "firstName lastName email phone")
    .populate("job", "title department")
    .populate("company", "name icon");

  if (!offer) return jsonError("No offer found for this candidate.", 404);

  const cand = offer.candidate as any;
  const job = offer.job as any;
  const company = offer.company as any;
  const companyName = company?.name || "Company";
  const companyIcon = company?.icon || "";

  const policy = await CompanyPolicy.findOne({ company: candidate.company });
  const foodAmt = policy ? Number(policy.foodAmount || 0) * 12 : 0;
  const travelAmt = policy ? Number(policy.travelAccommodationAmount || 0) * 12 : 0;

  const pfAmt = Number(offer.pfAmount || 0);
  const esicAmt = Number(offer.esicAmount || 0);
  const netTakeHome = Number(offer.offeredCTC) - pfAmt - esicAmt - foodAmt - travelAmt;

  const letterHtml = `
<div class="header">
  <div class="logo">
    ${companyIcon ? `<img src="${companyIcon}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" />` : `<div style="width:40px;height:40px;border-radius:8px;background:#0f172a;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">${companyName[0]}</div>`}
    <h2>${companyName}</h2>
  </div>
  <div class="divider"></div>
</div>

<h1>Offer Letter</h1>
<p>Dear ${cand.firstName} ${cand.lastName},</p>
<p>We are pleased to offer you the position of <strong>${offer.designation}</strong> at ${companyName}.</p>
<div class="details">
  <p><strong>Department:</strong> ${offer.department || job?.department || "N/A"}</p>
  <p><strong>Designation:</strong> ${offer.designation}</p>
  ${offer.officeLocation ? `<p><strong>Office Location:</strong> ${offer.officeLocation}</p>` : ""}
  ${offer.joiningDate ? `<p><strong>Joining Date:</strong> ${new Date(offer.joiningDate).toLocaleDateString()}</p>` : ""}
  <p><strong>Email:</strong> ${cand.email}</p>
  ${cand.phone ? `<p><strong>Phone:</strong> ${cand.phone}</p>` : ""}
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

<p>We look forward to having you on board!</p>
<div class="footer">
  <p>This is a system-generated offer letter.</p>
</div>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offer Letter - ${companyName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f1f5f9; }
  .toolbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 12px 24px; }
  .toolbar h3 { font-size: 16px; color: #0f172a; }
  .toolbar button { background: #0f172a; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .toolbar button:hover { background: #1e293b; }
  .letter-page { max-width: 210mm; margin: 24px auto; background: #fff; padding: 48px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 4px; }
  .header { text-align: center; margin-bottom: 32px; }
  .header h2 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; }
  .header .divider { margin: 12px auto 0; width: 80px; height: 3px; background: #4f46e5; }
  .header .logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }
  h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; font-size: 22px; }
  .details { margin: 24px 0; }
  .details p { margin: 6px 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  th { background: #f8fafc; font-weight: 600; }
  .total { font-weight: 700; }
  .deduction { color: #dc2626; }
  .net { color: #059669; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
  .perks { margin-top: 16px; padding: 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #92400e; }
  .perks h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #a16207; }
  .perks p { margin: 0; }
  p { font-size: 14px; margin-bottom: 12px; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .letter-page { margin: 0 auto; padding: 24px; box-shadow: none; border-radius: 0; max-width: 100%; }
  }
</style></head>
<body>
  <div class="toolbar">
    <h3>Offer Letter</h3>
    <button onclick="window.print()">Download PDF</button>
  </div>
  <div class="letter-page">
    ${letterHtml}
  </div>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="offer-letter.html"`,
    },
  });
}
