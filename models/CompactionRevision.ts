import { Schema, model, models, type InferSchemaType } from "mongoose";

const CompactionRevisionSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    compaction: {
      type: Schema.Types.ObjectId,
      ref: "TaskCompaction",
      default: null,
      index: true,
    },
    teamCompaction: {
      type: Schema.Types.ObjectId,
      ref: "TeamCompaction",
      default: null,
      index: true,
    },
    revisionNumber: { type: Number, required: true },
    previousContent: { type: Schema.Types.Mixed, default: {} },
    updatedContent: { type: Schema.Types.Mixed, default: {} },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changeReason: { type: String, default: "", maxlength: 4000 },
    action: {
      type: String,
      enum: ["edited", "correction_requested", "resubmitted", "reviewed", "comment", "sources_updated"],
      default: "edited",
    },
  },
  { timestamps: true },
);

CompactionRevisionSchema.index({ compaction: 1, revisionNumber: -1 });
CompactionRevisionSchema.index({ teamCompaction: 1, revisionNumber: -1 });

export type CompactionRevisionDocument = InferSchemaType<
  typeof CompactionRevisionSchema
>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).CompactionRevision;
}
export const CompactionRevision =
  (models as any).CompactionRevision ||
  model("CompactionRevision", CompactionRevisionSchema);
