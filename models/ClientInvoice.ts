import { Schema, model, models } from "mongoose";

const InvoiceItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ClientInvoiceSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null },
    region: { type: String, default: "", index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true, maxlength: 200 },
    clientEmail: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: "", maxlength: 2000 },
    items: { type: [InvoiceItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    gstAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    approvalStatus: { type: String, enum: ["pending-approval", "approved"], default: "pending-approval" },
    verificationStatus: { type: String, enum: ["none", "pending-verification", "verified"], default: "none" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorizer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ClientInvoiceSchema.index({ company: 1, createdAt: -1 });

export const ClientInvoice = models.ClientInvoice || model("ClientInvoice", ClientInvoiceSchema);
