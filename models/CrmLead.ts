import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmLeadNoteSchema = new Schema(
  { id: { type: String }, author: { type: String, default: "" }, text: { type: String, default: "" }, time: { type: String, default: "" } },
  { _id: false },
);

const CrmLeadSchema = new Schema(
  {
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    company: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    source: { type: String, default: "Website" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "New" },
    score: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    description: { type: String, default: "" },
    notes: { type: [CrmLeadNoteSchema], default: [] },
  },
  { timestamps: true, strict: false },
);

CrmLeadSchema.index({ owner: 1, createdAt: -1 });
CrmLeadSchema.index({ status: 1 });

export type CrmLeadDocument = InferSchemaType<typeof CrmLeadSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmLead;
}

export const CrmLead = models.CrmLead || model("CrmLead", CrmLeadSchema);
