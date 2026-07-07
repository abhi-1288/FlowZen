import { Schema, model, models, type InferSchemaType } from "mongoose";

const VisitorPassSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "VisitorEvent", default: null, index: true },
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
      enum: ["pending", "approved", "rejected", "expired"],
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
    identityCode: { type: String, default: "", unique: true, sparse: true, index: true },
  },
  { timestamps: true }
);

export type VisitorPassDocument = InferSchemaType<typeof VisitorPassSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).VisitorPass;
}

export const VisitorPass = models.VisitorPass || model("VisitorPass", VisitorPassSchema);
