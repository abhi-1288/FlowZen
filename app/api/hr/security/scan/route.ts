import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { VisitorPass } from "@/models/VisitorPass";
import { EntryLog } from "@/models/EntryLog";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const body = await request.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) return jsonError("Identity code is required.", 400);

  // Try to find an employee with this identity code
  const employee = await User.findOne({
    company: actor.company,
    companyIdentityCode: code,
  }).select("name email role companyStatus avatarUrl phone emergencyContact bloodGroup regionLabel").lean() as Record<string, unknown> | null;

  if (employee) {
    return NextResponse.json({
      type: "employee",
      data: {
        id: String(employee._id),
        name: employee.name,
        email: employee.email,
        role: employee.role,
        companyStatus: employee.companyStatus,
        avatarUrl: employee.avatarUrl,
        phone: employee.phone,
        emergencyContact: employee.emergencyContact,
        bloodGroup: employee.bloodGroup,
        regionLabel: employee.regionLabel,
      },
    });
  }

  // Try to find a visitor pass with this identity code
  const pass = await VisitorPass.findOne({
    company: actor.company,
    identityCode: code,
  }).lean() as Record<string, unknown> | null;

  if (pass) {
    const now = new Date();
    let status = String(pass.status ?? "");
    if (status === "approved" && pass.validUntil && new Date(String(pass.validUntil)) < now) {
      await VisitorPass.updateOne({ _id: pass._id }, { $set: { status: "expired" } });
      status = "expired";
    }

    return NextResponse.json({
      type: "visitor",
      data: {
        id: String(pass._id),
        visitorName: pass.visitorName,
        visitorEmail: pass.visitorEmail,
        visitorPhone: pass.visitorPhone,
        visitorCompany: pass.visitorCompany,
        purpose: pass.purpose,
        hostName: pass.hostName,
        status,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil,
        identityCode: pass.identityCode,
      },
    });
  }

  return NextResponse.json({ type: "not-found", data: null });
}
