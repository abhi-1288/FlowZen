import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

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

  if (body.address !== undefined) {
    const address = String(body.address ?? "").trim();
    if (address.length > 500) return jsonError("Address must be 500 characters or less.");
    company.address = address;
  }

  if (body.multiOffice !== undefined) {
    company.multiOffice = Boolean(body.multiOffice);

    // When enabling multi-office, migrate old single address into addresses as "Main Office"
    if (company.multiOffice && company.address && (!company.addresses || company.addresses.length === 0)) {
      company.addresses = [{
        label: "Main Office",
        line1: company.address,
        city: "",
        state: "",
        zip: "",
        country: "",
        isMain: true,
      }];
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
    }));
  }

  await company.save();

  return NextResponse.json({
    address: company.address,
    multiOffice: company.multiOffice,
    addresses: company.addresses,
  });
}
