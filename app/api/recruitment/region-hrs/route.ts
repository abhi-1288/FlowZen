import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const region = (searchParams.get("region") || "").trim();
  if (!region) return jsonError("Region is required.", 400);

  await connectDb();
  const user = await User.findById(userId);
  if (!user?.company) return jsonError("No company found.", 400);

  const company = (await Company.findById(user.company).select("addresses").lean()) as any;
  const entry = Array.isArray(company?.addresses)
    ? (company.addresses as any[]).find(
        (a) => String(a.label ?? "").trim().toLowerCase() === region.toLowerCase(),
      )
    : null;
  if (!entry) return jsonError("Region not found.", 404);

  const hrIds = Array.isArray(entry.hrs)
    ? entry.hrs.map((v: unknown) => String(v)).filter(Boolean)
    : [];
  const hrHeadId = String(entry.hrHead ?? "").trim();

  const ids = [...new Set([hrHeadId, ...hrIds])].filter(Boolean);
  const users = ids.length > 0
    ? await User.find({ _id: { $in: ids }, company: user.company })
        .select("name email role")
        .sort({ name: 1 })
    : [];

  const heads = users.filter((u) => String(u._id) === hrHeadId);
  const staff = users.filter((u) => String(u._id) !== hrHeadId);

  const toJson = (u: any) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
  });

  return NextResponse.json({
    region,
    hrHead: heads.length ? toJson(heads[0]) : null,
    hrs: staff.map(toJson),
    total: users.length,
  });
}