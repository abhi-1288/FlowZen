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
import { visitorPassIdCardContent } from "@/lib/email-templates";

async function generateIdentityCode({
  companyId,
  region,
  generatorName,
}: {
  companyId: string;
  region: string;
  generatorName: string;
}): Promise<string> {
  const company = (await Company.findById(companyId)
    .select("name")
    .lean()) as Record<string, unknown> | null;
  const companySlug = (company?.name ? String(company.name) : "unknown")
    .replace(/\s+/g, "_")
    .toLowerCase();
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
  { params }: { params: Promise<{ id: string }> },
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

  const actor = await User.findById(userId).select(
    "company role isSeniorSecurity",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (String(actor.role) === "employee") return jsonError("Forbidden.", 403);
  if (
    String(actor.role) === "security" &&
    !Boolean((actor as any).isSeniorSecurity)
  )
    return jsonError("Forbidden.", 403);

  const { id } = await params;
  type PassDoc = Record<string, unknown>;
  const pass = (await VisitorPass.findById(id).lean()) as PassDoc | null;
  if (!pass || String(pass.company) !== String(actor.company))
    return jsonError("Not found.", 404);

  // Auto-expire
  if (
    String(pass.status) === "approved" &&
    pass.validUntil &&
    new Date(String(pass.validUntil)) < new Date()
  ) {
    await VisitorPass.updateOne(
      { _id: pass._id },
      { $set: { status: "expired" } },
    );
    pass.status = "expired";
  }

  return NextResponse.json({ pass: { ...pass, id: String(pass._id) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const actor = await User.findById(userId).select(
    "name role company isSeniorSecurity",
  );
  if (!actor) return jsonError("User not found.", 404);

  if (!["admin", "human-resource"].includes(String(actor.role)))
    return jsonError("Forbidden.", 403);

  const { id } = await params;
  const body = await request.json();

  const pass = await VisitorPass.findById(id);
  if (!pass || String(pass.company) !== String(actor.company))
    return jsonError("Not found.", 404);

  const companyDoc = (await Company.findById(pass.company)
    .select("name")
    .lean()) as Record<string, unknown> | null;
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
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const verifyUrl = `${baseUrl}/verify-visitor/${pass.identityCode}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}`;

      const emailContent = visitorPassIdCardContent({ pass: pass as unknown as Record<string, unknown>, companyName, verifyUrl, qrSrc });

      sendMail({
        to: pass.visitorEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      }).catch(() => {
        /* email failure is non-critical */
      });
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

  return NextResponse.json({
    pass: { ...pass.toObject(), id: String(pass._id) },
  });
}
