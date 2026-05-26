import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { ClientInvoice } from "@/models/ClientInvoice";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const invoices = await ClientInvoice.find({ company: actor.company })
    .populate("board", "title")
    .populate("generatedBy", "name")
    .sort({ createdAt: -1 });

  return NextResponse.json({ invoices: serializeDocs(invoices as any) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);
  if (!["finance", "admin"].includes(String(actor.role))) return jsonError("Only finance and admin can create invoices.", 403);

  const body = await request.json();
  const boardId = String(body.boardId ?? "").trim() || null;
  const clientName = String(body.clientName ?? "").trim();
  const clientEmail = String(body.clientEmail ?? "").trim();
  const amount = Number(body.amount ?? 0);
  const description = String(body.description ?? "").trim();

  if (!clientName) return jsonError("Client name is required.", 400);
  if (amount <= 0) return jsonError("Amount must be greater than 0.", 400);

  const count = await ClientInvoice.countDocuments({ company: actor.company });
  const invoiceNumber = `INV-${String(actor.company).slice(-4)}-${String(count + 1).padStart(4, "0")}`;

  const invoice = await ClientInvoice.create({
    company: actor.company,
    board: boardId || undefined,
    invoiceNumber,
    clientName,
    clientEmail,
    amount,
    description,
    status: "pending",
    generatedBy: userId,
  });

  return NextResponse.json({ invoice: serializeDoc(invoice as any) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor || !actor.company || actor.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);
  if (!["finance", "admin"].includes(String(actor.role))) return jsonError("Only finance and admin can update invoices.", 403);

  const body = await request.json();
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");

  if (!id || !["pending", "paid"].includes(status)) return jsonError("Invalid request.", 400);

  const update: any = { status };
  if (status === "paid") update.paidAt = new Date();

  const invoice = await ClientInvoice.findOneAndUpdate(
    { _id: id, company: actor.company },
    { $set: update },
    { new: true },
  );
  if (!invoice) return jsonError("Invoice not found.", 404);

  return NextResponse.json({ invoice: serializeDoc(invoice as any) });
}
