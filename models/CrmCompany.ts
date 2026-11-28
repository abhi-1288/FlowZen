import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmCompanySchema = new Schema(
  {
    name: { type: String, default: "", trim: true, maxlength: 200 },
    industry: { type: String, default: "" },
    website: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    size: { type: String, default: "" },
    annualRevenue: { type: String, default: "" },
    country: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "Active" },
    type: { type: String, default: "Prospect" },
    clv: { type: Number, default: 0 },
    description: { type: String, default: "" },
    projects: { type: [String], default: [] },
  },
  { timestamps: true, strict: false },
);

CrmCompanySchema.index({ owner: 1, createdAt: -1 });
CrmCompanySchema.index({ name: 1 });

export type CrmCompanyDocument = InferSchemaType<typeof CrmCompanySchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmCompany;
}

export const CrmCompany = models.CrmCompany || model("CrmCompany", CrmCompanySchema);
