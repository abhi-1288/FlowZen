import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmContactSchema = new Schema(
  {
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany" },
    jobTitle: { type: String, default: "" },
    department: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, default: "Prospect" },
    status: { type: String, default: "Active" },
    lastInteraction: { type: String, default: "" },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true, strict: false },
);

CrmContactSchema.index({ owner: 1, createdAt: -1 });
CrmContactSchema.index({ company: 1 });

export type CrmContactDocument = InferSchemaType<typeof CrmContactSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmContact;
}

export const CrmContact = models.CrmContact || model("CrmContact", CrmContactSchema);
