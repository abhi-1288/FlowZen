import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { mainOfficeLabelOf, regionManagerCaps } from "@/lib/company-regions";

const cleanIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v ?? "").trim()).filter(Boolean) : [];

const positiveNumberOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function resolveManagerIds(
  companyId: string,
  hrIds: string[],
  adminIds: string[],
): Promise<{ hrs: string[]; admins: string[] }> {
  const all = [...new Set([...hrIds, ...adminIds])];
  if (all.length === 0) return { hrs: [], admins: [] };
  const users = await User.find({
    _id: { $in: all },
    company: companyId,
    companyStatus: "approved",
    role: { $in: ["human-resource", "admin"] },
  }).select("role");
  const hrs = new Set<string>();
  const admins = new Set<string>();
  for (const u of users) {
    const id = String(u._id);
    if (hrIds.includes(id) && String(u.role) === "human-resource") hrs.add(id);
    if (adminIds.includes(id) && String(u.role) === "admin") admins.add(id);
  }
  return { hrs: [...hrs], admins: [...admins] };
}

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

  const user = await User.findById(userId);
  if (!user?.company) return jsonError("No company found.", 400);

  const companyId =
    typeof user.company === "object" && user.company
      ? String((user.company as any)._id ?? "")
      : String(user.company);

  const company = (await Company.findById(companyId)
    .select("addresses multiOffice regionMaxHrs regionMaxAdmins")
    .lean()) as any;

  return NextResponse.json({
    addresses: (company?.addresses as any[]) || [],
    multiOffice: Boolean(company?.multiOffice),
    regionMaxHrs: Number(company?.regionMaxHrs ?? 5),
    regionMaxAdmins: Number(company?.regionMaxAdmins ?? 2),
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (user.role !== "admin" && user.role !== "human-resource") return jsonError("Only admins and HR can update company address.", 403);
  if (!user.company) return jsonError("You must have a registered company.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const company = await Company.findById(companyId);
  if (!company) return jsonError("Company not found.", 404);

  // HR submitting a new address for admin approval
  if (body.mode === "submit-address" && user.role === "human-resource") {
    const label = String(body.label ?? "").trim();
    const line1 = String(body.line1 ?? "").trim();
    const city = String(body.city ?? "").trim();
    const state = String(body.state ?? "").trim();
    const zip = String(body.zip ?? "").trim();
    const country = String(body.country ?? "").trim();
    const adminId = String(body.adminId ?? "").trim();

    if (!label) return jsonError("Region/office name is required.", 400);
    if (!line1) return jsonError("Address line 1 is required.", 400);
    if (!adminId) return jsonError("Please select an admin to approve.", 400);

    // Check that this HR is authorized to manage addresses
    const managers = (company.addressManagers ?? []).map((id: any) => String(id));
    if (!managers.includes(userId)) return jsonError("You are not authorized to submit addresses.", 403);

    const admin = await User.findOne({ _id: adminId, company: companyId, role: "admin", companyStatus: "approved" }).select("_id name");
    if (!admin) return jsonError("Selected admin not found or not approved.", 404);

    const joinRequest = await JoinRequest.create({
      requester: userId,
      approver: admin._id,
      company: companyId,
      kind: "region-address",
      status: "pending",
      metadata: {
        label,
        line1,
        city,
        state,
        zip,
        country,
        hrName: user.name,
        adminName: admin.name,
        hrId: String(user._id),
        adminId: String(admin._id),
      },
    });

    await Notification.create({
      user: admin._id,
      company: companyId,
      type: "approval",
      title: "Region Address Approval Required",
      message: `${user.name} (HR) has submitted a new office address "${label}" for approval.`,
    });
    emitNotification(String(admin._id));

    return NextResponse.json({ requestId: String(joinRequest._id), status: "submitted" });
  }

  // Owner/admin directly setting the primary (main) office address from onboarding
  if (body.mode === "set-main-address") {
    const label = String(body.label ?? "").trim() || "Main Office";
    const line1 = String(body.line1 ?? "").trim();
    const city = String(body.city ?? "").trim();
    const state = String(body.state ?? "").trim();
    const zip = String(body.zip ?? "").trim();
    const country = String(body.country ?? "").trim();

    const hrIds = cleanIds(body.hrIds);
    const adminIds = cleanIds(body.adminIds);
    const resolved = await resolveManagerIds(companyId, hrIds, adminIds);

    let hrHead = String(body.hrHeadId ?? "").trim();
    if (hrHead && !resolved.hrs.includes(hrHead)) hrHead = "";
    if (!hrHead && resolved.hrs.length > 0) hrHead = resolved.hrs[0];

    let adminHead = String(body.adminHeadId ?? "").trim();
    if (adminHead && !resolved.admins.includes(adminHead)) adminHead = "";
    if (!adminHead && user.role === "admin") adminHead = userId;
    if (!adminHead && resolved.admins.length > 0) adminHead = resolved.admins[0];

    const maxHrs = positiveNumberOrNull(body.maxHrs);
    const maxAdmins = positiveNumberOrNull(body.maxAdmins);

    const mainEntry: any = {
      label,
      line1,
      city,
      state,
      zip,
      country,
      isMain: true,
      hrs: resolved.hrs,
      admins: resolved.admins,
      hrHead: hrHead || null,
      adminHead: adminHead || null,
      maxHrs,
      maxAdmins,
      createdBy: userId,
    };

    company.addresses = [mainEntry];
    const composed = [label, line1, city, state, zip, country].filter(Boolean).join(", ");
    company.address = composed;
  }

  if (body.address !== undefined) {
    const address = String(body.address ?? "").trim();
    if (address.length > 500) return jsonError("Address must be 500 characters or less.");
    company.address = address;
  }

  // Assign/replace an existing region's HR & Admin staff, respecting min/caps
  if (body.mode === "assign-region-managers") {
    const label = String(body.label ?? "").trim();
    if (!label) return jsonError("Region label is required.", 400);

    const region = Array.isArray(company.addresses)
      ? company.addresses.find((a: any) => String(a.label ?? "").trim().toLowerCase() === label.toLowerCase())
      : null;
    if (!region) return jsonError("Region not found.", 404);

    if (user.role === "human-resource") {
      const mainLabel = mainOfficeLabelOf({ addresses: company.addresses, address: company.address });
      const isMainHr =
        !mainLabel ||
        String(user.regionLabel ?? "").trim().toLowerCase() === mainLabel.toLowerCase();
      const regionStaffing = (region as any) ?? {};
      const regionHrs = Array.isArray(regionStaffing.hrs)
        ? regionStaffing.hrs.map((v: any) => String(v))
        : [];
      const isRegionStaffedHr =
        String(regionStaffing.hrHead ?? "") === userId || regionHrs.includes(userId);
      if (!isMainHr && !isRegionStaffedHr) {
        return jsonError("Only an admin or this region's HR can manage its staff.", 403);
      }
    }

    const hrIds = cleanIds(body.hrIds);
    const adminIds = cleanIds(body.adminIds);
    const resolved = await resolveManagerIds(companyId, hrIds, adminIds);
    const currentHrs = cleanIds((region as any).hrs);
    const currentAdmins = cleanIds((region as any).admins);

    if (resolved.hrs.length === 0 && currentHrs.length > 0) {
      return jsonError("A region must keep at least 1 assigned HR.", 400);
    }
    if (resolved.admins.length === 0 && currentAdmins.length > 0) {
      return jsonError("A region must keep at least 1 assigned admin.", 400);
    }

    const caps = regionManagerCaps(company, region);
    if (resolved.hrs.length > caps.maxHrs) {
      return jsonError(`This region allows at most ${caps.maxHrs} HRs.`, 400);
    }
    if (resolved.admins.length > caps.maxAdmins) {
      return jsonError(`This region allows at most ${caps.maxAdmins} admins.`, 400);
    }

    let hrHead = String(body.hrHeadId ?? "").trim();
    const oldHrHead = cleanIds([(region as any).hrHead])[0] ?? "";
    if (hrHead && !resolved.hrs.includes(hrHead)) hrHead = "";
    if (!hrHead) hrHead = resolved.hrs.includes(oldHrHead) ? oldHrHead : resolved.hrs[0] ?? "";

    let adminHead = String(body.adminHeadId ?? "").trim();
    const oldAdminHead = cleanIds([(region as any).adminHead])[0] ?? "";
    if (adminHead && !resolved.admins.includes(adminHead)) adminHead = "";
    if (!adminHead) adminHead = resolved.admins.includes(oldAdminHead) ? oldAdminHead : resolved.admins[0] ?? "";

    (region as any).hrs = resolved.hrs;
    (region as any).admins = resolved.admins;
    (region as any).hrHead = hrHead || null;
    (region as any).adminHead = adminHead || null;
    company.markModified("addresses");
  }

  // Set region staffing caps: company-wide defaults, or per-region override on the main office
  if (body.mode === "set-region-caps") {
    const mainLabel = mainOfficeLabelOf({ addresses: company.addresses, address: company.address });
    const isMainOfficeActor =
      user.role === "admin" ||
      (user.role === "human-resource" &&
        (!mainLabel || String(user.regionLabel ?? "").trim().toLowerCase() === mainLabel.toLowerCase()));
    if (!isMainOfficeActor) {
      return jsonError("Only the main office admin or HR can adjust region caps.", 403);
    }

    const rawMaxHrs = body.maxHrs !== undefined ? Number(body.maxHrs) : null;
    const rawMaxAdmins = body.maxAdmins !== undefined ? Number(body.maxAdmins) : null;

    if (body.label !== undefined) {
      const label = String(body.label ?? "").trim();
      const region = Array.isArray(company.addresses)
        ? company.addresses.find((a: any) => String(a.label ?? "").trim().toLowerCase() === label.toLowerCase())
        : null;
      if (!region) return jsonError("Region not found.", 404);
      if (body.useDefaults === true) {
        (region as any).maxHrs = null;
        (region as any).maxAdmins = null;
      } else {
        if (rawMaxHrs != null) {
          if (!Number.isFinite(rawMaxHrs) || rawMaxHrs < 1) return jsonError("Max HRs must be at least 1.", 400);
          (region as any).maxHrs = rawMaxHrs;
        }
        if (rawMaxAdmins != null) {
          if (!Number.isFinite(rawMaxAdmins) || rawMaxAdmins < 1) return jsonError("Max admins must be at least 1.", 400);
          (region as any).maxAdmins = rawMaxAdmins;
        }
      }
      company.markModified("addresses");
    } else {
      if (rawMaxHrs != null) {
        if (!Number.isFinite(rawMaxHrs) || rawMaxHrs < 1) return jsonError("Max HRs must be at least 1.", 400);
        company.regionMaxHrs = rawMaxHrs;
      }
      if (rawMaxAdmins != null) {
        if (!Number.isFinite(rawMaxAdmins) || rawMaxAdmins < 1) return jsonError("Max admins must be at least 1.", 400);
        company.regionMaxAdmins = rawMaxAdmins;
      }
    }
  }

  if (body.multiOffice !== undefined) {
    company.multiOffice = Boolean(body.multiOffice);

    // When enabling multi-office, migrate old single address into addresses as "Main Office"
    if (company.multiOffice && company.address && (!company.addresses || company.addresses.length === 0)) {
      const mainEntry: any = {
        label: "Main Office",
        line1: company.address,
        city: "",
        state: "",
        zip: "",
        country: "",
        isMain: true,
        hrs: [],
        admins: [userId],
        hrHead: null,
        adminHead: userId,
        maxHrs: null,
        maxAdmins: null,
        createdBy: userId,
      };
      company.addresses = [mainEntry];
    }
  }

  if (body.addressManagers !== undefined) {
    if (!Array.isArray(body.addressManagers)) return jsonError("addressManagers must be an array.");
    company.addressManagers = body.addressManagers.map((id: any) => String(id));
  }

  if (body.addresses !== undefined) {
    if (!Array.isArray(body.addresses)) return jsonError("Addresses must be an array.");
    company.addresses = body.addresses.map((a: any) => ({
      label: String(a.label ?? "").trim(),
      line1: String(a.line1 ?? "").trim(),
      city: String(a.city ?? "").trim(),
      state: String(a.state ?? "").trim(),
      zip: String(a.zip ?? "").trim(),
      country: String(a.country ?? "").trim(),
      isMain: Boolean(a.isMain),
      hrs: cleanIds(a.hrs),
      admins: cleanIds(a.admins),
      hrHead: cleanIds([a.hrHead])[0] ?? null,
      adminHead: cleanIds([a.adminHead])[0] ?? null,
      maxHrs: positiveNumberOrNull(a.maxHrs),
      maxAdmins: positiveNumberOrNull(a.maxAdmins),
      createdBy: cleanIds([a.createdBy])[0] ?? null,
    }));
  }

  await company.save();

  const mainAddress = Array.isArray(company.addresses)
    ? company.addresses.find((a: any) => Boolean(a?.isMain)) ?? company.addresses[0] ?? null
    : null;

  return NextResponse.json({
    address: company.address,
    multiOffice: company.multiOffice,
    addresses: company.addresses,
    regionMaxHrs: Number(company.regionMaxHrs ?? 5),
    regionMaxAdmins: Number(company.regionMaxAdmins ?? 2),
    needsHrAssign: !cleanIds([mainAddress?.hrHead])[0],
  });
}
