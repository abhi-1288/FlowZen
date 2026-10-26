import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { ClientInvoice } from "@/models/ClientInvoice";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { financeMemberScope } from "@/lib/finance-scope";
import { calculateInvoiceTotals } from "@/lib/invoice";
import { delegationForFeature, delegationIdFromRequest } from "@/lib/delegation-access";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("company companyStatus role regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);
  const roleAllowed = ["finance", "admin"].includes(String(actor.role));
  const delegated = roleAllowed ? false : Boolean(await delegationForFeature(userId, delegationIdFromRequest(request), "finance-invoices"));
  if (!roleAllowed && !delegated) return jsonError("Only finance and admin can view invoices.", 403);

  const regionScope = await financeMemberScope(actor);
  const regionFilter = String(actor.role) === "admin" ? {} : (regionScope.memberIds ? { region: regionScope.region } : {});

  const invoices = await ClientInvoice.find({ company: actor.company, ...regionFilter })
    .populate("board", "title")
    .populate("generatedBy", "name")
    .populate("approvedBy", "name")
    .populate("company")
    .sort({ createdAt: -1 });

  return NextResponse.json({ invoices: serializeDocs(invoices as any) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("name role company companyStatus regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);
  const roleAllowed = ["finance", "admin"].includes(String(actor.role));
  const delegation = roleAllowed ? null : await delegationForFeature(userId, delegationIdFromRequest(request), "finance-invoices");
  const delegated = Boolean(delegation);
  if (!roleAllowed && !delegated) return jsonError("Only finance and admin can create invoices.", 403);

  const body = await request.json();
  const boardId = String(body.boardId ?? "").trim() || null;
  const clientName = String(body.clientName ?? "").trim();
  const clientEmail = String(body.clientEmail ?? "").trim();
  const description = String(body.description ?? body.serviceDescription ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const gstRate = Number(body.gstRate ?? 0);
  const totals = calculateInvoiceTotals(items, gstRate);
  const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
  const regionScope = await financeMemberScope(actor);

  if (!clientName) return jsonError("Client name is required.", 400);
  if (!totals.items.length || totals.items.some((item: any) => !item.description || item.quantity <= 0 || item.rate < 0)) return jsonError("Add at least one valid invoice item.", 400);
  if (totals.total <= 0) return jsonError("Invoice total must be greater than 0.", 400);

  const count = await ClientInvoice.countDocuments({ company: actor.company });
  const invoiceNumber = `INV-${String(actor.company).slice(-4)}-${String(count + 1).padStart(4, "0")}`;

  const requiresVerification = delegated && Boolean((delegation as any)?.requiresVerification);
  const authorizerId = delegated ? String((delegation as any)?.authorizer ?? "") : "";

  const invoice = await ClientInvoice.create({
    company: actor.company,
    board: boardId || undefined,
    invoiceNumber,
    region: regionScope.region,
    clientName,
    clientEmail,
    description,
    items: totals.items,
    subtotal: totals.subtotal,
    gstRate: totals.gstRate,
    gstAmount: totals.gstAmount,
    total: totals.total,
    amount: totals.total,
    dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
    status: "pending",
    approvalStatus: "pending-approval",
    verificationStatus: requiresVerification ? "pending-verification" : "none",
    submittedBy: requiresVerification ? userId : null,
    authorizer: requiresVerification && authorizerId ? authorizerId : null,
    generatedBy: userId,
  });

  if (requiresVerification && authorizerId) {
    try {
      await Notification.create({
        user: authorizerId,
        company: actor.company,
        type: "approval",
        title: "Invoice Pending Verification",
        message: `Invoice ${invoiceNumber} for ${clientName} (₹${totals.total.toLocaleString("en-IN")}) submitted by ${actor.name ?? "Finance"} awaits your verification.`,
        link: `/invoice/${String(invoice._id)}`,
      });
      emitNotification(authorizerId);
    } catch {}
  } else {
    try {
      const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
      if (admins.length) {
        await Notification.insertMany(admins.map((a: any) => ({
          user: a._id,
          company: actor.company,
          type: "approval",
          title: "Invoice awaiting approval",
          message: `Invoice ${invoiceNumber} for ${clientName} (₹${totals.total.toLocaleString("en-IN")}) created by ${actor.name ?? "Finance"} awaits your approval.`,
          link: `/invoice/${String(invoice._id)}`,
        })));
        admins.forEach((a: any) => emitNotification(String(a._id)));
      }
    } catch {}
  }

  return NextResponse.json({ invoice: serializeDoc(invoice as any) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("name role company companyStatus regionLabel");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);
  const roleAllowed = ["finance", "admin"].includes(String(actor.role));
  const delegated = roleAllowed ? false : Boolean(await delegationForFeature(userId, delegationIdFromRequest(request), "finance-invoices"));
  if (!roleAllowed && !delegated) return jsonError("Only finance and admin can update invoices.", 403);

  const body = await request.json();
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  const action = String(body.action ?? "");

  // Admin/authorizer verification step.
  if (action === "verify") {
    const invoice = await ClientInvoice.findOne({ _id: id, company: actor.company });
    if (!invoice) return jsonError("Invoice not found.", 404);
    if (invoice.verificationStatus !== "pending-verification") return jsonError("This invoice is not pending verification.", 400);
    const isAdminHr = ["admin", "human-resource"].includes(String(actor.role));
    const isAuthorizer = (invoice as any).authorizer && String((invoice as any).authorizer) === userId;
    if (!isAdminHr && !isAuthorizer) return jsonError("Forbidden.", 403);
    if (String((invoice as any).submittedBy) === userId) return jsonError("You cannot verify your own submission.", 403);

    (invoice as any).verificationStatus = "verified";
    (invoice as any).verifiedBy = userId;
    (invoice as any).verifiedAt = new Date();
    await invoice.save();

    // Notify admins for final approval.
    try {
      const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
      if (admins.length) {
        await Notification.insertMany(admins.map((a: any) => ({
          user: a._id,
          company: actor.company,
          type: "approval",
          title: "Invoice Pending Approval",
          message: `Invoice ${invoice.invoiceNumber} for ${invoice.clientName} verified by ${actor.name ?? "Approver"} awaits final approval.`,
          link: `/invoice/${String(invoice._id)}`,
        })));
        admins.forEach((a: any) => emitNotification(String(a._id)));
      }
    } catch {}

    return NextResponse.json({ invoice: serializeDoc(invoice as any) });
  }

  // Admin approval / e-signature step.
  if (action === "approve") {
    if (String(actor.role) !== "admin") return jsonError("Only admin can approve invoices.", 403);
    const invoice = await ClientInvoice.findOne({ _id: id, company: actor.company });
    if (!invoice) return jsonError("Invoice not found.", 404);
    invoice.approvalStatus = "approved";
    (invoice as any).approvedBy = userId;
    (invoice as any).approvedAt = new Date();
    await invoice.save();

    try {
      const financeUsers = await User.find({ company: actor.company, role: "finance", companyStatus: "approved" }).select("_id");
      if (financeUsers.length) {
        await Notification.insertMany(financeUsers.map((u: any) => ({
          user: u._id,
          company: actor.company,
          type: "info",
          title: "Invoice approved",
          message: `Invoice ${invoice.invoiceNumber} for ${invoice.clientName} has been approved by admin and is ready to send.`,
          link: `/invoice/${String(invoice._id)}`,
        })));
        financeUsers.forEach((u: any) => emitNotification(String(u._id)));
      }
    } catch {}

    if (invoice.clientEmail) {
      try {
        const { sendMail } = await import("@/lib/mailer");
        const company = await (await import("@/models/Company")).Company.findById(actor.company).select("name address addresses").lean();
        const companyName = String((company as any)?.name ?? "Company");
        const link = `${process.env.NEXTAUTH_URL || ""}/invoice/${String(invoice._id)}`;
        await sendMail({
          to: String(invoice.clientEmail),
          cc: process.env.SMTP_USER,
          subject: `Invoice ${invoice.invoiceNumber} from ${companyName}`,
          text: `Dear ${invoice.clientName},\n\nPlease find your invoice ${invoice.invoiceNumber} (Total: ₹${Number(invoice.total ?? 0).toLocaleString("en-IN")}) at: ${link}\n\nThank you,\n${companyName}`,
          html: `<p>Dear ${invoice.clientName},</p><p>Please find your invoice <strong>${invoice.invoiceNumber}</strong> (Total: ₹${Number(invoice.total ?? 0).toLocaleString("en-IN")}) here: <a href="${link}">${link}</a></p><p>Thank you,<br/>${companyName}</p>`,
        });
      } catch {}
    }

    return NextResponse.json({ invoice: serializeDoc(invoice as any) });
  }

  if (!id || !["pending", "paid"].includes(status)) return jsonError("Invalid request.", 400);

  const update: any = { status };
  if (status === "paid") update.paidAt = new Date();

  const regionScope = await financeMemberScope(actor);
  const invoice = await ClientInvoice.findOneAndUpdate(
    { _id: id, company: actor.company, ...(regionScope.memberIds ? { region: regionScope.region } : {}) },
    { $set: update },
    { new: true },
  );
  if (!invoice) return jsonError("Invoice not found.", 404);

  return NextResponse.json({ invoice: serializeDoc(invoice as any) });
}
