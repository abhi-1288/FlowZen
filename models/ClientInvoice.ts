import { Schema, model, models } from "mongoose";

const ClientInvoiceSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null },
    invoiceNumber: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true, maxlength: 200 },
    clientEmail: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ClientInvoiceSchema.index({ company: 1, createdAt: -1 });

export const ClientInvoice = models.ClientInvoice || model("ClientInvoice", ClientInvoiceSchema);
