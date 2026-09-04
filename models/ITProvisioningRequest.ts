import { Schema, model, models, type InferSchemaType } from "mongoose";

const ActivitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { timestamps: true },
);

const ITProvisioningRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    employeeName: { type: String, default: "" },
    department: { type: String, default: "" },
    designation: { type: String, default: "" },
    email: { type: String, default: "" },
    manager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    managerName: { type: String, default: "" },
    requestedRole: { type: String, default: "employee" },
    requiredAccess: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdByName: { type: String, default: "" },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "ACCOUNT_CREATED", "COMPLETED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    accountCreatedAt: { type: Date, default: null },
    createdAccountUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
    activity: { type: [ActivitySchema], default: [] },
  },
  { timestamps: true },
);

ITProvisioningRequestSchema.index({ company: 1, status: 1, createdAt: -1 });

export type ITProvisioningRequestDocument = InferSchemaType<typeof ITProvisioningRequestSchema>;
if (process.env.NODE_ENV === "development") {
  delete models.ITProvisioningRequest;
}

export const ITProvisioningRequest =
  models.ITProvisioningRequest || model("ITProvisioningRequest", ITProvisioningRequestSchema);
