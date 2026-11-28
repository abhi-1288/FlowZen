import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmActivitySchema = new Schema(
  {
    title: { type: String, default: "", trim: true },
    type: { type: String, default: "Task" },
    contact: { type: Schema.Types.ObjectId, ref: "CrmContact" },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany" },
    deal: { type: Schema.Types.ObjectId, ref: "CrmDeal" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: String, default: "" },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    priority: { type: String, default: "Medium" },
    status: { type: String, default: "Upcoming" },
    reminder: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true, strict: false },
);

CrmActivitySchema.index({ owner: 1, createdAt: -1 });
CrmActivitySchema.index({ status: 1 });

export type CrmActivityDocument = InferSchemaType<typeof CrmActivitySchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmActivity;
}

export const CrmActivity = models.CrmActivity || model("CrmActivity", CrmActivitySchema);
