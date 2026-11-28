import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmQuotationItemSchema = new Schema(
  { id: { type: String }, name: { type: String, default: "" }, description: { type: String, default: "" }, qty: { type: Number, default: 1 }, price: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, tax: { type: Number, default: 0 } },
  { _id: false },
);

const CrmQuotationSchema = new Schema(
  {
    number: { type: String, default: "", trim: true },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany" },
    contact: { type: Schema.Types.ObjectId, ref: "CrmContact" },
    deal: { type: Schema.Types.ObjectId, ref: "CrmDeal" },
    issueDate: { type: String, default: "" },
    expiryDate: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    paymentTerms: { type: String, default: "Net 30" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "Draft" },
    version: { type: String, default: "v1.0" },
    items: { type: [CrmQuotationItemSchema], default: [] },
    notes: { type: String, default: "" },
  },
  { timestamps: true, strict: false },
);

CrmQuotationSchema.index({ number: 1 });

export type CrmQuotationDocument = InferSchemaType<typeof CrmQuotationSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmQuotation;
}

export const CrmQuotation = models.CrmQuotation || model("CrmQuotation", CrmQuotationSchema);
