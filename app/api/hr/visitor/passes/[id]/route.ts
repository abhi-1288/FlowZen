import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { Company } from "@/models/Company";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { sendMail } from "@/lib/mailer";

async function generateIdentityCode({
  companyId,
  region,
  generatorName,
}: {
  companyId: string;
  region: string;
  generatorName: string;
}): Promise<string> {
  const company = await Company.findById(companyId).select("name").lean() as Record<string, unknown> | null;
  const companySlug = (company?.name ? String(company.name) : "unknown").replace(/\s+/g, "_").toLowerCase();
  const regionSlug = region ? region.replace(/\s+/g, "_").toLowerCase() : "na";
  const nameSlug = generatorName.replace(/\s+/g, "_").toLowerCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand4 = String(Math.floor(1000 + Math.random() * 9000));
    const code = `${companySlug}-${regionSlug}-${rand4}-${nameSlug}`;
    const existing = await VisitorPass.findOne({ identityCode: code }).lean();
    if (!existing) return code;
  }
  const rand8 = String(Math.floor(10000000 + Math.random() * 90000000));
  return `${companySlug}-${regionSlug}-${rand8}-${nameSlug}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (String(actor.role) === "employee") return jsonError("Forbidden.", 403);
  if (String(actor.role) === "security" && !Boolean((actor as any).isSeniorSecurity)) return jsonError("Forbidden.", 403);

  const { id } = await params;
  type PassDoc = Record<string, unknown>;
  const pass = await VisitorPass.findById(id).lean() as PassDoc | null;
  if (!pass || String(pass.company) !== String(actor.company)) return jsonError("Not found.", 404);

  // Auto-expire
  if (
    String(pass.status) === "approved" &&
    pass.validUntil &&
    new Date(String(pass.validUntil)) < new Date()
  ) {
    await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "expired" } });
    pass.status = "expired";
  }

  return NextResponse.json({ pass: { ...pass, id: String(pass._id) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("name role company isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);

  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();

  const pass = await VisitorPass.findById(id);
  if (!pass || String(pass.company) !== String(actor.company)) return jsonError("Not found.", 404);

  const companyDoc = await Company.findById(pass.company).select("name").lean() as Record<string, unknown> | null;
  const companyName = companyDoc?.name ? String(companyDoc.name) : "Company";

  if (body.status === "approved") {
    pass.approver = userId;
    pass.validFrom = pass.timeIn || new Date();
    pass.validUntil = pass.timeOut || null;
    pass.rejectionReason = "";
    pass.status = "approved";

    if (!pass.identityCode) {
      pass.identityCode = await generateIdentityCode({
        companyId: String(pass.company),
        region: pass.region,
        generatorName: actor.name ?? "Unknown",
      });
    }

    const signed = Boolean(body.signed);
    if (signed) {
      pass.isSigned = true;
      pass.signedBy = actor.name ?? "Unknown";
      pass.signedRole = actor.role ?? "";
      pass.signedAt = new Date();
    }

    await pass.save();

    // Notify creator
    if (pass.createdBy) {
      await Notification.create({
        user: pass.createdBy,
        company: pass.company,
        type: "approval",
        title: "Visitor Pass Approved",
        message: `The visitor pass for ${pass.visitorName} has been approved. ID: ${pass.identityCode}`,
        body: `Company: ${companyName}\nVisitor: ${pass.visitorName}\nRegion: ${pass.region || "N/A"}\nTime In: ${pass.timeIn ? new Date(pass.timeIn).toLocaleString("en-IN") : "N/A"}\nTime Out: ${pass.timeOut ? new Date(pass.timeOut).toLocaleString("en-IN") : "N/A"}\nPass ID: ${pass.identityCode}`,
        link: "/profile-hub?tab=visitors",
      });
      emitNotification(String(pass.createdBy));
    }

    // Send email to visitor with temporary ID card
    if (pass.visitorEmail) {
      const validFromStr = pass.validFrom ? new Date(pass.validFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
      const validUntilStr = pass.validUntil ? new Date(pass.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
      const hostName = pass.hostName ? String(pass.hostName) : "—";
      const visitorCompany = pass.visitorCompany ? String(pass.visitorCompany) : "—";
      const region = pass.region ? String(pass.region) : "Main Office";
      const purpose = pass.purpose ? String(pass.purpose) : "—";

      // Signature info
      const signedBy = pass.signedBy ? String(pass.signedBy) : null;
      const signedRole = pass.signedRole ? String(pass.signedRole) : null;
      const signedAt = pass.signedAt ? new Date(pass.signedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const verifyUrl = `${baseUrl}/verify-visitor/${pass.identityCode}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}`;

      sendMail({
        to: pass.visitorEmail,
        subject: `Your Temporary ID Card – ${companyName}`,
        text: `Your temporary visitor pass for ${companyName} has been approved.\n\nPass ID: ${pass.identityCode}\nRegion: ${region}\nValid From: ${validFromStr}\nValid Until: ${validUntilStr}\nHost: ${hostName}\n\nPlease present this QR code or Pass ID at the security gate upon arrival.\n\nThank you,\n${companyName} Security Team`,
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    .email-card { max-width:500px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .card-header { background:#1e293b;padding:20px 24px;text-align:center; }
    .card-header h2 { margin:0;font-size:18px;font-weight:700;color:#ffffff; }
    .card-header p { margin:4px 0 0;font-size:12px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase; }
    .visitor-badge { display:inline-block;margin-top:-12px;margin-bottom:12px;background:#d97706;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 16px;border-radius:0 0 6px 6px; }
    .detail-section { padding:8px 24px; }
    .detail-row { display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9; }
    .detail-label { width:110px;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0; }
    .detail-value { font-size:13px;color:#0f172a;font-weight:600; }
    .qr-section { text-align:center;padding:16px 24px; }
    .qr-section img { display:block;margin:0 auto;border-radius:8px;border:1px solid #e2e8f0; }
    .footer-note { padding:0 24px 12px;text-align:center;font-size:11px;color:#94a3b8;line-height:1.5; }
    .card-footer { background:#f8fafc;padding:14px 24px;text-align:center;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8; }
    .back-section { border-top:2px dashed #e2e8f0;margin:16px 24px 0;padding:16px 0; }
    .back-row { display:flex;padding:5px 0; }
    .back-label { font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;width:110px;flex-shrink:0; }
    .back-value { font-size:12px;color:#334155;font-weight:500; }
    .signature-block { border-top:1px solid #e2e8f0;margin:12px 24px 0;padding:12px 24px 16px;text-align:center; }
    .signature-name { font-size:16px;font-weight:700;color:#1e293b;font-family:'Georgia',serif;margin:0; }
    .signature-role { font-size:11px;color:#64748b;margin:2px 0 0; }
    .signature-date { font-size:10px;color:#94a3b8;margin:2px 0 0; }
    .valid-row { display:flex;gap:12px;padding:8px 24px; }
    .valid-box { flex:1;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:10px 14px;text-align:center; }
    .valid-label { font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 2px; }
    .valid-value { font-size:12px;font-weight:600;color:#0f172a;margin:0; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
    <tr>
      <td align="center">
        <table class="email-card" cellpadding="0" cellspacing="0">

          <!-- ═══ FRONT CARD ═══ -->
          <tr>
            <td class="card-header">
              <h2>${companyName}</h2>
              <p>Visitor ID Card</p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:0">
              <span class="visitor-badge">Visitor</span>
            </td>
          </tr>

          <!-- Details -->
          <tr><td class="detail-section">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td class="detail-row"><span class="detail-label">Pass ID</span><span class="detail-value" style="font-family:monospace">${pass.identityCode}</span></td></tr>
              <tr><td class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${pass.visitorName}</span></td></tr>
              <tr><td class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${pass.visitorPhone || "—"}</span></td></tr>
              <tr><td class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${pass.visitorEmail}</span></td></tr>
              <tr><td class="detail-row"><span class="detail-label">Region</span><span class="detail-value">${region}</span></td></tr>
            </table>
          </td></tr>

          <!-- Valid from / until -->
          <tr><td>
            <table width="100%" cellpadding="0" cellspacing="0" class="valid-row">
              <tr>
                <td class="valid-box"><p class="valid-label">Valid From (±15 min)</p><p class="valid-value">${validFromStr}</p></td>
                <td class="valid-box" style="margin-left:12px"><p class="valid-label">Valid Until (±15 min)</p><p class="valid-value" style="color:#d97706">${validUntilStr}</p></td>
              </tr>
            </table>
          </td></tr>

          <!-- QR -->
          <tr><td class="qr-section">
            <img src="${qrSrc}" alt="QR Code" width="140" />
            <p style="margin:4px 0 0;font-size:10px;color:#94a3b8">Scan to Verify</p>
          </td></tr>

          <!-- Signature -->
          ${signedBy ? `
          <tr><td class="signature-block">
            <p class="signature-name">${signedBy}</p>
            <p class="signature-role">${signedRole}</p>
            <p class="signature-date">Signed on ${signedAt}</p>
          </td></tr>
          ` : `
          <tr><td class="signature-block">
            <p class="signature-name" style="color:#cbd5e1">Authorised</p>
            <p class="signature-role" style="color:#cbd5e1">Authorised Signature</p>
          </td></tr>
          `}

          <!-- ═══ BACK CARD ═══ -->
          <tr><td class="back-section">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td class="back-row"><span class="back-label">Purpose</span><span class="back-value">${purpose}</span></td></tr>
              <tr><td class="back-row"><span class="back-label">Host</span><span class="back-value">${hostName}</span></td></tr>
              <tr><td class="back-row"><span class="back-label">Company</span><span class="back-value">${visitorCompany}</span></td></tr>
              <tr><td class="back-row"><span class="back-label">Visiting Office</span><span class="back-value">${region}</span></td></tr>
            </table>
          </td></tr>

          <!-- Footer note -->
          <tr><td class="footer-note">
            Please present this QR code or Pass ID at the security gate upon arrival.<br>
            Entry may be permitted 15 minutes before or after the scheduled time.
          </td></tr>

          <tr><td class="card-footer">${companyName} · Security Team</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }).catch(() => { /* email failure is non-critical */ });
    }
  } else if (body.status === "rejected") {
    pass.status = "rejected";
    pass.rejectionReason = String(body.rejectionReason ?? "").trim();
    await pass.save();

    // Notify creator
    if (pass.createdBy) {
      await Notification.create({
        user: pass.createdBy,
        company: pass.company,
        type: "approval",
        title: "Visitor Pass Rejected",
        message: `The visitor pass for ${pass.visitorName} was rejected. Reason: ${pass.rejectionReason || "No reason provided."}`,
        body: `Company: ${companyName}\nVisitor: ${pass.visitorName}\nReason: ${pass.rejectionReason || "No reason provided."}`,
        link: "/profile-hub?tab=visitors",
      });
      emitNotification(String(pass.createdBy));
    }
  } else {
    return jsonError("Invalid status.", 400);
  }

  return NextResponse.json({ pass: { ...pass.toObject(), id: String(pass._id) } });
}
