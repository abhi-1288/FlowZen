import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { effectiveRegionLabelOf, regionApproverClause, effectiveRegionApproverClause, type OfficeAddressLike } from "@/lib/company-regions";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role");
    if (!roleParam) return jsonError("role query param required");

    // Comma-separated roles are matched with $in; a single role stays exact.
    const roles = roleParam
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
    if (roles.length === 0) return jsonError("role query param required");

    await connectDb();
    const user = await User.findById(userId);
    if (!user || !user.company) return jsonError("No company", 400);

    const filter: Record<string, unknown> = {
      company: user.company,
      role: roles.length === 1 ? roles[0] : { $in: roles },
      companyStatus: "approved",
    };

    const isSeniorSecurity = url.searchParams.get("isSeniorSecurity") === "true";
    if (isSeniorSecurity) {
      filter.isSeniorSecurity = true;
    }

    const select = "name email role regionLabel isSeniorSecurity";

    // Opt-in: `region=mine` restricts results to the requester's own region.
    // Callers that omit it keep the company-wide list they had before.
    //
    // `regionFallback=main` additionally counts members with no stored
    // `regionLabel` as being in the main office, matching how their profile
    // displays and how `resolveNomination` validates. Used only by the
    // document-letter co-approver picker, so the picker and that validator
    // share one rule; the strict clause stays in place for every other caller.
    let region = "";
    let regionFallback = false;
    if (url.searchParams.get("region") === "mine") {
      const company = (await Company.findById(user.company)
        .select("addresses address")
        .lean()) as { addresses?: OfficeAddressLike[] | null; address?: string | null } | null;
      region = effectiveRegionLabelOf(company, user);
      const clause =
        url.searchParams.get("regionFallback") === "main"
          ? effectiveRegionApproverClause(company, region)
          : regionApproverClause(company, region);
      const scoped = { ...filter, ...(clause ?? {}) };
      const scopedUsers = await User.find(scoped).select(select);
      if (scopedUsers.length > 0 || !clause) {
        return NextResponse.json({ users: scopedUsers, region, regionFallback: false });
      }
      // Region has no matching approver — fall back to the company-wide list.
      regionFallback = true;
    }

    const users = await User.find(filter).select(select);

    return NextResponse.json({ users, region, regionFallback });
  } catch (err: any) {
    return jsonError(err.message || "Error", 500);
  }
}
