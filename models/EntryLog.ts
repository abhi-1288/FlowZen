import { Schema, model, models, type InferSchemaType } from "mongoose";

const EntryLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    visitorPass: { type: Schema.Types.ObjectId, ref: "VisitorPass", default: null, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    type: { type: String, enum: ["entry", "exit"], required: true, index: true },
    method: { type: String, enum: ["qr-scan", "manual", "id-card"], default: "qr-scan" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

EntryLogSchema.index({ company: 1, timestamp: -1 });

export type EntryLogDocument = InferSchemaType<typeof EntryLogSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).EntryLog;
}

export const EntryLog = models.EntryLog || model("EntryLog", EntryLogSchema);
