import { Schema, model, models, type InferSchemaType } from "mongoose";

const TeamCompactionSourceSchema = new Schema(
  {
    teamCompaction: {
      type: Schema.Types.ObjectId,
      ref: "TeamCompaction",
      required: true,
      index: true,
    },
    employeeCompaction: {
      type: Schema.Types.ObjectId,
      ref: "TaskCompaction",
      required: true,
      index: true,
    },
    inclusionStatus: {
      type: String,
      enum: ["included", "excluded"],
      default: "included",
      index: true,
    },
    exclusionReason: { type: String, default: "", maxlength: 2000 },
    // Snapshot of ownership/period so a later correction cannot change what the
    // Team Owner originally included.
    employee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    employeeName: { type: String, default: "" },
    compactionType: { type: String, enum: ["EOD", "EOW", "MIXED"], default: "EOD" },
    reportingDate: { type: Date, default: null },
    sourceSummary: { type: String, default: "", maxlength: 12000 },
    sourceContent: { type: Schema.Types.Mixed, default: {} },
    includedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    excludedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

TeamCompactionSourceSchema.index(
  { teamCompaction: 1, employeeCompaction: 1 },
  { unique: true, name: "team_source_unique" },
);

export type TeamCompactionSourceDocument = InferSchemaType<
  typeof TeamCompactionSourceSchema
>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).TeamCompactionSource;
}
export const TeamCompactionSource =
  (models as any).TeamCompactionSource ||
  model("TeamCompactionSource", TeamCompactionSourceSchema);
