import { Schema, model, models, type InferSchemaType } from "mongoose";

const VisitorEventSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slug: { type: String, required: true, unique: true, index: true },
    visitorCompany: { type: String, default: "" },
    expectedDate: { type: Date, default: null },
    purpose: { type: String, default: "" },
    hostName: { type: String, default: "" },
    hostEmail: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
      index: true,
    },
  },
  { timestamps: true }
);

export type VisitorEventDocument = InferSchemaType<typeof VisitorEventSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).VisitorEvent;
}

export const VisitorEvent = models.VisitorEvent || model("VisitorEvent", VisitorEventSchema);
