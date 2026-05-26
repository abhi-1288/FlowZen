import { Schema, model, models } from "mongoose";

const ResourceItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, default: "", maxlength: 500 },
  },
  { _id: false },
);

const ResourceRequestSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [ResourceItemSchema], required: true, validate: [(val: any[]) => val.length > 0, "At least one item is required."] },
    notes: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

ResourceRequestSchema.index({ company: 1, status: 1, createdAt: -1 });

export const ResourceRequest = models.ResourceRequest || model("ResourceRequest", ResourceRequestSchema);
