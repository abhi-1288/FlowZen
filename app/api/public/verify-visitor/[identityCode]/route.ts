import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { VisitorPass } from "@/models/VisitorPass";

type PassDoc = Record<string, unknown>;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ identityCode: string }> }
) {
  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const { identityCode } = await params;

  const pass = await VisitorPass.findOne({ identityCode }).lean() as PassDoc | null;
  if (!pass) {
    return NextResponse.json({ verified: false, reason: "not-found" });
  }

  const now = new Date();

  if (String(pass.status) === "expired" || (pass.validUntil && new Date(String(pass.validUntil)) < now)) {
    return NextResponse.json({ verified: false, reason: "expired" });
  }

  if (String(pass.status) !== "approved") {
    return NextResponse.json({ verified: false, reason: "not-approved" });
  }

  return NextResponse.json({
    verified: true,
    visitorName: pass.visitorName,
    visitorCompany: pass.visitorCompany,
    purpose: pass.purpose,
    hostName: pass.hostName,
    validFrom: pass.validFrom,
    validUntil: pass.validUntil,
  });
}
