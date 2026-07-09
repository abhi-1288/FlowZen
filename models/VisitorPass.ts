import { Schema, model, models, type InferSchemaType } from "mongoose";

const VisitorPassSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "VisitorEvent", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    visitorName: { type: String, required: true },
    visitorEmail: { type: String, required: true },
    visitorPhone: { type: String, default: "" },
    visitorCompany: { type: String, default: "" },
    purpose: { type: String, default: "" },
    idDocumentUrl: { type: String, default: "" },
    hostName: { type: String, default: "" },
    region: { type: String, default: "" },
    visitAddress: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired", "active", "completed"],
      default: "pending",
      index: true,
    },
    approver: { type: Schema.Types.ObjectId, ref: "User", default: null },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    isSigned: { type: Boolean, default: false },
    signedBy: { type: String, default: "" },
    signedRole: { type: String, default: "" },
    signedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    identityCode: { type: String, default: "", index: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    timeIn: { type: Date, default: null },
    timeOut: { type: Date, default: null },
    entryTime: { type: Date, default: null },
    exitTime: { type: Date, default: null },
  },
  { timestamps: true }
);

export type VisitorPassDocument = InferSchemaType<typeof VisitorPassSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).VisitorPass;
}

export const VisitorPass = models.VisitorPass || model("VisitorPass", VisitorPassSchema);
