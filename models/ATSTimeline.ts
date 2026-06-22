import { Schema, model, models, type InferSchemaType } from "mongoose";

const ATSTimelineSchema = new Schema(
  {
    candidate: { type: Schema.Types.ObjectId, ref: "ATSCandidate", required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: "ATSJob", required: true },
    action: {
      type: String,
      enum: [
        "applied",
        "resume-uploaded",
        "interview-scheduled",
        "interview-completed",
        "offer-generated",
        "offer-accepted",
        "offer-rejected",
        "stage-changed",
        "joined",
        "rejected",
        "note-added",
      ],
      required: true,
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true }
);

ATSTimelineSchema.index({ candidate: 1, createdAt: -1 });
ATSTimelineSchema.index({ company: 1, createdAt: -1 });

export type ATSTimelineDocument = InferSchemaType<typeof ATSTimelineSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).ATSTimeline;
}

export const ATSTimeline = (models as any).ATSTimeline || model("ATSTimeline", ATSTimelineSchema);
