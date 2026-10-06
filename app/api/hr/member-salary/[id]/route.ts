import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { effectiveRegionLabelOf, isUserInEffectiveRegion, type OfficeAddressLike } from "@/lib/company-regions";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: memberId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(memberId)) return jsonError("Invalid member id.");

  let body: { baseSalary?: number; amount?: number; currency?: string; salaryType?: string };
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("Invalid JSON", 400);
  }

  const salaryType =
    typeof body.salaryType === "string" &&
    ["per-annum", "per-month", "per-day", "per-hour"].includes(body.salaryType)
      ? body.salaryType
      : "per-month";

  const rawAmount = Math.max(0, Number(body.amount ?? body.baseSalary ?? 0));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return jsonError("Enter a valid salary amount.");
  }

  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : undefined;

  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus name regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const actorRole = String(actor.role ?? "");
  if (!["human-resource", "admin"].includes(actorRole)) {
    return jsonError("Only HR or admin can set member salary.", 403);
  }

  const member = await User.findOne({
    _id: memberId,
    company: actor.company,
    companyStatus: "approved",
  }).select("name company membershipHistory baseSalary salaryHistory");
  if (!member) return jsonError("Member not found.", 404);

  if (actorRole === "human-resource") {
    const enrollingHr = await resolveEnrollingHr(member);
    if (enrollingHr?.id && enrollingHr.id !== userId) {
      return jsonError("Only the enrolling HR or admin can set this salary.", 403);
    }
  }

  // Regional admins can only set salary for members in their own region.
  // The company owner and HR keep the company-wide view.
  if (actorRole === "admin") {
    const company = (await Company.findById(actor.company).select("owner addresses address").lean()) as {
      owner?: unknown;
      addresses?: OfficeAddressLike[] | null;
      address?: string | null;
    } | null;
    const ownerId = company?.owner ?? null;
    const isOwner = ownerId != null && String(ownerId) === String(actor._id);
    if (!isOwner) {
      const adminRegion = effectiveRegionLabelOf(company, actor);
      if (adminRegion && !isUserInEffectiveRegion(company, adminRegion, member)) {
        return jsonError(`This member is outside your region (${adminRegion}).`, 403);
      }
    }
  }

  const oldSalary = Math.max(
    0,
    Number(
      salaryType === "per-hour"
        ? member.hourlyRate ?? 0
        : salaryType === "per-day"
          ? member.dailyRate ?? 0
          : member.baseSalary ?? 0,
    ),
  );

  if (salaryType === "per-hour") {
    member.salaryType = "per-hour";
    member.hourlyRate = rawAmount;
    member.dailyRate = 0;
    member.baseSalary = 0;
  } else if (salaryType === "per-day") {
    member.salaryType = "per-day";
    member.dailyRate = rawAmount;
    member.hourlyRate = 0;
    member.baseSalary = 0;
  } else {
    const baseSalary =
      salaryType === "per-annum" ? Math.round(rawAmount / 12) : rawAmount;
    member.salaryType = salaryType;
    member.baseSalary = baseSalary;
    member.hourlyRate = 0;
    member.dailyRate = 0;
  }

  if (currency) member.salaryCurrency = currency;
  if (!Array.isArray(member.salaryHistory)) member.salaryHistory = [];
  member.salaryHistory.push({
    amount: rawAmount,
    date: new Date(),
    type: rawAmount >= oldSalary ? "increment" : "decrement",
  });
  await member.save();

  await recordAudit({
    action: "member.salary.change",
    actionLabel: "Salary changed",
    company: member.company ?? null,
    actor: { id: actor._id, name: actor.name, role: actor.role },
    target: { id: member._id, name: member.name, role: member.role },
    from: { amount: oldSalary, salaryType: member.salaryType ?? salaryType },
    to: { amount: rawAmount, salaryType },
    metadata: { currency },
    result: "success",
    request,
  });

  return NextResponse.json({
    ok: true,
    salaryType,
    amount: rawAmount,
  });
}
