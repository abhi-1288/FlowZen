import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmDealSchema = new Schema(
  {
    title: { type: String, default: "", trim: true },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany" },
    contact: { type: Schema.Types.ObjectId, ref: "CrmContact" },
    pipeline: { type: String, default: "Enterprise Sales" },
    stage: { type: String, default: "NEW" },
    value: { type: Number, default: 0 },
    probability: { type: Number, default: 0 },
    closeDate: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    priority: { type: String, default: "Medium" },
    description: { type: String, default: "" },
    notes: { type: [String], default: [] },
    lostReason: { type: String, default: "" },
  },
  { timestamps: true, strict: false },
);

CrmDealSchema.index({ owner: 1, createdAt: -1 });
CrmDealSchema.index({ stage: 1 });

export type CrmDealDocument = InferSchemaType<typeof CrmDealSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmDeal;
}

export const CrmDeal = models.CrmDeal || model("CrmDeal", CrmDealSchema);
