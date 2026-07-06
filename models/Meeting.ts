import { Schema, model, models, type InferSchemaType } from "mongoose";

const MeetingSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 1000 },
    meetingType: { type: String, enum: ["online", "offline"], default: "online" },
    meetingLink: { type: String, default: "", maxlength: 500 },
    location: { type: String, default: "", maxlength: 300 },
    date: { type: Date, required: true },
    time: { type: String, default: "" },
    durationMinutes: { type: Number, default: 30 },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" }
  },
  { timestamps: true }
);

MeetingSchema.index({ company: 1, date: 1 });

export type MeetingDocument = InferSchemaType<typeof MeetingSchema>;
if (process.env.NODE_ENV === "development") {
  delete models.Meeting;
}

export const Meeting = models.Meeting || model("Meeting", MeetingSchema);
