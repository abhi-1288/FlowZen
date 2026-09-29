import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import {
  procurementMemberUserFilter,
  procurementScope,
  resolveProcurementRoute,
} from "@/lib/procurement";

/**
 * Who the current member may hand a purchase request to. The route is derived
 * from their role server-side, so the picker can never offer the wrong desk —
 * and the region filter matches the validation in POST.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus regionLabel",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const route = resolveProcurementRoute(user.role);
  const scope = await procurementScope(user as any);
  const roles: readonly string[] =
    route === "it" ? ["it-admin", "it-administration"] : ["finance"];

  const assignees = await User.find({
    company: user.company,
    companyStatus: "approved",
    role: { $in: [...roles] },
    ...procurementMemberUserFilter(scope),
  })
    .select("name email role")
    .sort({ name: 1 });

  return NextResponse.json({
    route,
    region: scope.region,
    regionFallback: !scope.memberIds,
    assignees: assignees.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });
}
