import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import bcrypt from "bcryptjs";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { emitNotification } from "@/lib/realtime";
import { canManageIt, pushProvisioningActivity } from "@/lib/it";
import { sendMail } from "@/lib/mailer";
import { employeeAccountContent } from "@/lib/email-templates";
import { buildOrigin } from "@/lib/candidate-portal";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid request id.", 400);
  const body = await request.json();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select(
    "role company companyStatus name isSeniorSecurity email",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to create accounts.", 403);
  }
  if (!canManageIt(String(actor.role), Boolean(actor.isSeniorSecurity))) {
    return jsonError("Only IT admins can create accounts from provisioning requests.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;
  const companyName = String((actor.company as any)?.name ?? "");

  const req = await ITProvisioningRequest.findOne({ _id: id, company: companyId });
  if (!req) return jsonError("Provisioning request not found.", 404);
  if (req.status === "REJECTED") return jsonError("This provisioning request was rejected.", 400);
  if (req.status === "ACCOUNT_CREATED" || req.status === "COMPLETED") {
    return jsonError("An account has already been created for this request.", 400);
  }

  // Email: default to the request's email (registered), but allow IT to set a custom email.
  const email = String(body.email ?? req.email ?? "").trim().toLowerCase();
  if (!email) return jsonError("An employee email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Invalid employee email.");

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return jsonError("A user with this email already exists.", 409);
  }

  // Password: provided by IT, or generate a temporary one.
  let password = String(body.password ?? "").trim();
  const autoGenerate = !password;
  if (!password || password.length < 6) {
    const suffix = Math.floor(100 + Math.random() * 900);
    password = `Pass@#${suffix}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const requestedRole = String(req.requestedRole ?? "employee").trim();

  // The employee record may already exist (converted candidate) or be created fresh.
  let employee: any = req.employee ? await User.findById(req.employee) : null;

  if (employee) {
    // Update the existing (pending) employee record.
    employee.email = email;
    employee.passwordHash = passwordHash;
    employee.emailVerified = true;
    employee.authProvider = "credentials";
    if (!employee.role || employee.role === "others") employee.role = requestedRole;
    if (req.manager) employee.manager = req.manager;
    if (req.designation) employee.customRole = req.designation;
    await employee.save();
  } else {
    employee = await User.create({
      name: req.employeeName || "New Employee",
      email,
      passwordHash,
      role: requestedRole,
      company: companyId,
      companyStatus: "approved",
      emailVerified: true,
      authProvider: "credentials",
      customRole: req.designation || "",
    });
    req.employee = employee._id;
    await Attendance.create({
      user: employee._id,
      date: new Date(),
      checkIn: null,
      checkOut: null,
      status: "present",
    });
  }

  req.email = email;
  req.status = "ACCOUNT_CREATED";
  req.createdAccountUserId = employee._id;
  req.accountCreatedAt = new Date();
  pushProvisioningActivity(
    req,
    { _id: actor._id },
    "Account created",
    `Account created for ${req.employeeName} (${email}, role: ${requestedRole}) by ${actor.name}`,
  );
  await req.save();

  // Notify HR who created the request.
  const createdBy = String(req.createdBy ?? "");
  if (createdBy && createdBy !== userId) {
    await Notification.create({
      user: createdBy,
      company: companyId,
      type: "info",
      title: "Account created",
      message: `IT created the account for ${req.employeeName} (${email}).`,
    });
    emitNotification(createdBy);
  }

  // Send welcome email with credentials.
  try {
    const loginUrl = `${buildOrigin(request)}/login`;
    const emailContent = employeeAccountContent({
      firstName: req.employeeName.split(" ")[0] || req.employeeName,
      companyName,
      email,
      password,
      loginUrl,
    });
    await sendMail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch (emailError) {
    console.error("Welcome email failed:", emailError);
  }

  return NextResponse.json({
    request: serializeDoc(req),
    accountCreated: true,
    email,
    autoGeneratedPassword: autoGenerate,
  });
}