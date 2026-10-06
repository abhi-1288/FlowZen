import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { effectiveRegionLabelOf, isMainOfficeLabel, isMainOfficeRegion, regionManagerCaps } from "@/lib/company-regions";
import { isCompanyOwner } from "@/lib/admin-region-scope";

const cleanIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v ?? "").trim()).filter(Boolean) : [];

const cleanContacts = (value: unknown): { name: string; phone: string; email: string; isPrimary: boolean }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      name: String(c.name ?? "").trim(),
      phone: String(c.phone ?? "").trim(),
      email: String(c.email ?? "").trim(),
      isPrimary: Boolean(c.isPrimary),
    }))
    .filter((c) => c.name.length > 0)
    .slice(0, 5);
};

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
    .select("addresses address multiOffice regionMaxHrs regionMaxAdmins")
    .lean()) as any;

  const addresses = (company?.addresses as any[]) || [];

  return NextResponse.json({
    addresses,
    multiOffice: Boolean(company?.multiOffice),
    regionMaxHrs: Number(company?.regionMaxHrs ?? 5),
    regionMaxAdmins: Number(company?.regionMaxAdmins ?? 2),
    // Whether the caller sits in the main office, i.e. may delegate a region's
    // recruitment pipeline. The UI uses it to decide whether to render the
    // delegation control; the PATCH route re-checks it server-side either way.
    isMainOffice: isMainOfficeRegion({ addresses, address: company?.address ?? "" }, user),
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

    const contacts = cleanContacts(body.contacts);
    if (contacts.length === 0) return jsonError("At least one contact is required for the address.", 400);
    if (contacts.length > 5) return jsonError("Maximum 5 contacts allowed per address.", 400);
    const primaryCount = contacts.filter((c) => c.isPrimary).length;
    if (primaryCount > 1) return jsonError("Only one primary contact allowed per address.", 400);

    // Update the existing main entry in place rather than replacing the array.
    //
    // This used to assign `company.addresses = [mainEntry]`, which destroyed every
    // other office in the company. That was survivable while offices were only a
    // display concern, but the main office is now the identity of the recruitment
    // pipeline: who raises requisitions, who can delegate a region, who sees every
    // candidate. Wiping the roster on an address correction would silently demote
    // every regional head to a scoped viewer and unstaff every office besides the
    // one being edited.
    //
    // Staffing, heads, caps and pipeline delegations are carried over from the
    // entry already there. Only the address fields (and the staffing the caller
    // explicitly sent) are replaced. Array position is preserved for the same
    // reason: `isMainOfficeLabel` falls back to index 0 when no entry carries
    // `isMain`, so reordering would move the HQ.
    const existing = Array.isArray(company.addresses) ? company.addresses : [];
    const mainIndex = existing.findIndex((a: any) => Boolean(a?.isMain));
    const fallbackIndex = mainIndex >= 0 ? mainIndex : existing.findIndex((a: any) => a);
    const prior: any = fallbackIndex >= 0 ? existing[fallbackIndex] : null;

    const mainEntry: any = {
      ...(prior ?? {}),
      _id: prior?._id,
      label,
      line1,
      city,
      state,
      zip,
      country,
      isMain: true,
      hrs: hrIds.length ? resolved.hrs : (prior ? cleanIds(prior.hrs) : []),
      admins: adminIds.length ? resolved.admins : (prior ? cleanIds(prior.admins) : []),
      hrHead: hrHead || prior?.hrHead || null,
      adminHead: adminHead || prior?.adminHead || null,
      maxHrs: maxHrs ?? prior?.maxHrs ?? null,
      maxAdmins: maxAdmins ?? prior?.maxAdmins ?? null,
      pipelineManagers: prior ? cleanIds(prior.pipelineManagers) : [],
      createdBy: prior?.createdBy || userId,
      contacts,
    };

    if (existing.length === 0) {
      company.addresses = [mainEntry];
    } else {
      // Exactly one entry may carry `isMain`; everything else is a plain region.
      // Nothing enforced this before, so a company that already has two mains gets
      // normalised on the next save rather than staying ambiguous forever.
      const next = existing.map((a: any, i: number) => {
        if (i === fallbackIndex) return mainEntry;
        return a?.isMain ? { ...a, isMain: false } : a;
      });
      company.addresses = next;
    }

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
      const regionStaffing = (region as any) ?? {};
      const regionHrs = Array.isArray(regionStaffing.hrs)
        ? regionStaffing.hrs.map((v: any) => String(v))
        : [];
      const isRegionStaffedHr =
        String(regionStaffing.hrHead ?? "") === userId || regionHrs.includes(userId);
      if (!isMainOfficeRegion({ addresses: company.addresses, address: company.address }, user) && !isRegionStaffedHr) {
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

    const contacts = cleanContacts(body.contacts);
    if (contacts.length > 5) return jsonError("Maximum 5 contacts allowed per address.", 400);
    const primaryCount = contacts.filter((c) => c.isPrimary).length;
    if (primaryCount > 1) return jsonError("Only one primary contact allowed per address.", 400);

    (region as any).hrs = resolved.hrs;
    (region as any).admins = resolved.admins;
    (region as any).hrHead = hrHead || null;
    (region as any).adminHead = adminHead || null;
    if (contacts.length > 0) {
      (region as any).contacts = contacts;
    }
    company.markModified("addresses");
  }

  // Delegate a region's recruitment pipeline to that region's HR / Admin heads.
  //
  // Main office only — and unlike `set-region-caps` below, that includes admins
  // who are *not* in the main office. Granting pipeline authority is the one
  // action a region must not be able to take for itself: if a regional admin
  // could tick themselves here, the delegation would be self-issuing and the whole
  // main-office tier would collapse into whoever asks first. An admin in a region
  // they were themselves granted is still refused.
  if (body.mode === "set-pipeline-managers") {
    const isMainOfficeActor =
      isCompanyOwner(company as any, user as any) ||
      ((user.role === "admin" || user.role === "human-resource") &&
        isMainOfficeRegion({ addresses: company.addresses, address: company.address }, user));
    if (!isMainOfficeActor) {
      return jsonError("Only the main office admin or HR can delegate a region's recruitment pipeline.", 403);
    }

    const label = String(body.label ?? "").trim();
    if (!label) return jsonError("Region label is required.", 400);
    const region = Array.isArray(company.addresses)
      ? company.addresses.find((a: any) => String(a.label ?? "").trim().toLowerCase() === label.toLowerCase())
      : null;
    if (!region) return jsonError("Region not found.", 404);

    const requested = cleanIds(body.pipelineManagers);
    if (requested.length > 0) {
      // Reject rather than silently drop. `resolveManagerIds` is built to
      // sanitise a roster, but a delegation that quietly loses a recipient looks
      // exactly like a delegation that worked until someone tries to use it.
      const valid = await User.find({
        _id: { $in: requested },
        company: companyId,
        companyStatus: "approved",
        role: { $in: ["human-resource", "admin"] },
      })
        .select("_id")
        .lean();
      const validIds = new Set(valid.map((u: any) => String(u._id)));
      const rejected = requested.filter((id) => !validIds.has(id));
      if (rejected.length > 0) {
        return jsonError(
          "These users cannot run a recruitment pipeline: they must be approved HR or Admin members of this company.",
          400,
        );
      }
      (region as any).pipelineManagers = requested;
    } else {
      (region as any).pipelineManagers = [];
    }
    company.markModified("addresses");
  }

  // Set region staffing caps: company-wide defaults, or per-region override on the main office
  if (body.mode === "set-region-caps") {
    // Any admin may set company-wide defaults; overriding a single region's cap is
    // main-office only, so a regional admin cannot lift its own headcount limit.
    const isMainOfficeActor =
      user.role === "admin" ||
      (user.role === "human-resource" &&
        isMainOfficeRegion({ addresses: company.addresses, address: company.address }, user));
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
        contacts: [],
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

    // Bulk replacement of the region roster is a company-level action: only
    // the owner or a main-office admin may do it. Regional admins must use the
    // per-region staffing mode instead.
    const isOwner = isCompanyOwner(company, user);
    const adminRegion = effectiveRegionLabelOf(company, user);
    const isMainOfficeActor = !adminRegion || isMainOfficeLabel(company, adminRegion);
    if (!isOwner && !isMainOfficeActor) {
      return jsonError("Only the company owner or a main-office admin can replace the addresses list.", 403);
    }

    const resolvedEntries: any[] = [];
    for (const a of body.addresses) {
      const resolved = await resolveManagerIds(companyId, cleanIds(a.hrs), cleanIds(a.admins));

      const contacts = cleanContacts(a.contacts);
      if (contacts.length > 0) {
        if (contacts.length > 5) return jsonError(`Region "${String(a.label ?? "").trim()}" allows at most 5 contacts.`, 400);
        const primaryCount = contacts.filter((c) => c.isPrimary).length;
        if (primaryCount > 1) return jsonError(`Region "${String(a.label ?? "").trim()}" allows only one primary contact.`, 400);
      }

      const entry: any = {
        label: String(a.label ?? "").trim(),
        line1: String(a.line1 ?? "").trim(),
        city: String(a.city ?? "").trim(),
        state: String(a.state ?? "").trim(),
        zip: String(a.zip ?? "").trim(),
        country: String(a.country ?? "").trim(),
        isMain: Boolean(a.isMain),
        hrs: resolved.hrs,
        admins: resolved.admins,
        hrHead: cleanIds([a.hrHead])[0] ?? null,
        adminHead: cleanIds([a.adminHead])[0] ?? null,
        maxHrs: positiveNumberOrNull(a.maxHrs),
        maxAdmins: positiveNumberOrNull(a.maxAdmins),
        createdBy: cleanIds([a.createdBy])[0] ?? null,
        contacts,
      };
      if (entry.hrHead && !resolved.hrs.includes(entry.hrHead)) entry.hrHead = null;
      if (entry.adminHead && !resolved.admins.includes(entry.adminHead)) entry.adminHead = null;

      const caps = regionManagerCaps(company, entry);
      if (resolved.hrs.length > caps.maxHrs) {
        return jsonError(`Region "${entry.label}" allows at most ${caps.maxHrs} HRs.`, 400);
      }
      if (resolved.admins.length > caps.maxAdmins) {
        return jsonError(`Region "${entry.label}" allows at most ${caps.maxAdmins} admins.`, 400);
      }

      resolvedEntries.push(entry);
    }
    company.addresses = resolvedEntries;
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
