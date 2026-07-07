import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { JoinRequest } from "@/models/JoinRequest";
import { jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ identityCode: string }> }
) {
  const { identityCode } = await params;
  if (!identityCode || identityCode === "—") {
    return jsonError("Invalid identity code.", 400);
  }

  await connectDb();

  const user = await User.findOne({
    companyIdentityCode: identityCode,
  }).populate("company", "name icon status primaryColor");

  if (!user) {
    return NextResponse.json({ verified: false, reason: "not-found", message: "No employee found with this ID." });
  }

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const approved = await JoinRequest.findOne({
    requester: user._id,
    company: companyId,
    kind: "id-card",
    status: "approved",
  }).select("_id metadata").lean() as Record<string, unknown> | null;

  if (!approved) {
    const revoked = await JoinRequest.findOne({
      requester: user._id,
      company: companyId,
      kind: "id-card",
    }).select("status").lean() as Record<string, unknown> | null;

    const reason = revoked ? "revoked" : "not-issued";
    const message = revoked
      ? "This ID card has been revoked. Please contact HR."
      : "No ID card has been issued for this employee.";
    return NextResponse.json({ verified: false, reason, message });
  }

  const companyDoc = user.company as unknown as { _id: string; name: string; icon?: string; status?: string; primaryColor?: string } | null;

  return NextResponse.json({
    verified: true,
    name: user.name,
    role: user.customRole || user.role,
    companyIdentityCode: user.companyIdentityCode,
    companyJoined: user.companyJoined,
    companyStatus: user.companyStatus,
    avatarUrl: user.avatarUrl || "",
    company: companyDoc
        ? {
            name: companyDoc.name,
            icon: companyDoc.icon || "",
            status: companyDoc.status || "active",
            primaryColor: companyDoc.primaryColor || "#2563eb",
          }
      : null,
  });
}
