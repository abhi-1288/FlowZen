import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSOffer } from "@/models/ATSOffer";
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

  const candidate = offer.candidate as any;
  const job = offer.job as any;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1e293b; }
  h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  .details { margin: 24px 0; }
  .details p { margin: 6px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
</style></head>
<body>
  <h1>Offer Letter</h1>
  <p>Dear ${candidate.firstName} ${candidate.lastName},</p>
  <p>We are pleased to offer you the position of <strong>${offer.designation}</strong>.</p>
  <div class="details">
    <p><strong>Department:</strong> ${offer.department || job?.department || "N/A"}</p>
    <p><strong>Offered CTC:</strong> ₹${Number(offer.offeredCTC).toLocaleString()}</p>
    ${offer.joiningDate ? `<p><strong>Joining Date:</strong> ${new Date(offer.joiningDate).toLocaleDateString()}</p>` : ""}
    <p><strong>Email:</strong> ${candidate.email}</p>
    ${candidate.phone ? `<p><strong>Phone:</strong> ${candidate.phone}</p>` : ""}
  </div>
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
