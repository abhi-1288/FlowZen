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
  const companyName = company?.name ? String(company.name) : "unknown";
  const regionSlug = region ? region.replace(/\s+/g, "-").toLowerCase() : "na";
  const rand4 = String(Math.floor(1000 + Math.random() * 9000));
  return `${companyName}-${regionSlug}-${rand4}-${generatorName}`;
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
      const timeInStr = pass.timeIn ? new Date(pass.timeIn).toLocaleString("en-IN") : "N/A";
      const timeOutStr = pass.timeOut ? new Date(pass.timeOut).toLocaleString("en-IN") : "N/A";

      sendMail({
        to: pass.visitorEmail,
        subject: `Your Temporary ID Card – ${companyName}`,
        text: `Your temporary visitor pass for ${companyName} has been approved.\n\nPass ID: ${pass.identityCode}\nRegion: ${pass.region || "N/A"}\nTime In: ${timeInStr}\nTime Out: ${timeOutStr}\n\nPlease present this Pass ID at the security gate upon arrival.\n\nThank you,\n${companyName} Security Team`,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;padding:20px">
          <div style="max-width:480px;margin:auto;background:white;border-radius:12px;padding:24px;border:1px solid #e0e0e0">
            <h2 style="margin:0 0 4px;color:#1e293b">Temporary ID Card</h2>
            <p style="margin:0 0 16px;color:#64748b;font-size:13px">${companyName}</p>
            <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:16px">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b">Visitor</p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1e293b">${pass.visitorName}</p>
              <table style="width:100%;font-size:13px">
                <tr><td style="color:#64748b;padding:2px 0">Pass ID</td><td style="font-weight:600;text-align:right;font-family:monospace">${pass.identityCode}</td></tr>
                <tr><td style="color:#64748b;padding:2px 0">Region</td><td style="text-align:right">${pass.region || "N/A"}</td></tr>
                <tr><td style="color:#64748b;padding:2px 0">Time In</td><td style="text-align:right">${timeInStr}</td></tr>
                <tr><td style="color:#64748b;padding:2px 0">Time Out</td><td style="text-align:right">${timeOutStr}</td></tr>
              </table>
            </div>
            <p style="font-size:12px;color:#94a3b8;text-align:center">Present this Pass ID at the security gate upon arrival.</p>
          </div></body></html>`,
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
