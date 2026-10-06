import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { canViewAuditCenter, escapeRegex } from "@/lib/audit";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select(
    "role company companyStatus isSeniorSecurity",
  );
  if (!actor || !actor.company || String(actor.companyStatus) !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }
  if (
    !canViewAuditCenter(String(actor.role ?? ""), Boolean((actor as any).isSeniorSecurity))
  ) {
    return jsonError("You do not have access to the audit center.", 403);
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 25) || 25),
  );
  const q = String(url.searchParams.get("q") ?? "").trim();
  const actionFilter = String(url.searchParams.get("action") ?? "").trim();
  const resultFilter = String(url.searchParams.get("result") ?? "").trim();
  const fromRaw = String(url.searchParams.get("from") ?? "").trim();
  const toRaw = String(url.searchParams.get("to") ?? "").trim();

  const query: Record<string, any> = { company: actor.company };

  const orClauses: Record<string, any>[] = [];
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    orClauses.push(
      { actorName: re },
      { actorEmail: re },
      { targetName: re },
      { action: re },
      { actionLabel: re },
    );
  }
  if (orClauses.length) query.$or = orClauses;

  if (resultFilter === "success" || resultFilter === "failed") {
    query.result = resultFilter;
  }

  if (actionFilter) {
    query.action = { $regex: `^${escapeRegex(actionFilter)}` };
  }

  const createdAtScope: Record<string, any> = {};
  const fromTime = new Date(fromRaw).getTime();
  const toTime = new Date(toRaw).getTime();
  if (fromRaw && !Number.isNaN(fromTime)) createdAtScope.$gte = new Date(fromRaw);
  if (toRaw && !Number.isNaN(toTime)) {
    const end = new Date(toRaw);
    end.setHours(23, 59, 59, 999);
    createdAtScope.$lte = end;
  }
  if (Object.keys(createdAtScope).length) query.createdAt = createdAtScope;

  const total = await AuditLog.countDocuments(query);
  const items = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return NextResponse.json({
    items: items.map((doc: any) => serializeDoc(doc)),
    total,
    page,
    limit,
  });
}