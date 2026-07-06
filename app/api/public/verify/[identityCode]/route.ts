import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
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
    return jsonError("No employee found with this ID.", 404);
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
