import { Schema, model, models, type InferSchemaType } from "mongoose";

const LostCardReportSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    status: {
      type: String,
      enum: ["reported", "replacement-requested", "replaced", "found"],
      default: "reported",
      index: true,
    },
    reportedAt: { type: Date, default: Date.now },
    replacementRequestedAt: { type: Date, default: null },
    replacementIssuedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

LostCardReportSchema.index({ company: 1, status: 1 });

export type LostCardReportDocument = InferSchemaType<typeof LostCardReportSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).LostCardReport;
}

export const LostCardReport = models.LostCardReport || model("LostCardReport", LostCardReportSchema);
