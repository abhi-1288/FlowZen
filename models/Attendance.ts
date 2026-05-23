import { Schema, model, models } from "mongoose";

const AttendanceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true }, // Normalized to start of day
    checkIn: { type: Date, default: Date.now },
    checkOut: { type: Date },
    status: { type: String, enum: ["present", "leave"], default: "present" },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === "development") {
  delete (models as any).Attendance;
}

export const Attendance = models.Attendance || model("Attendance", AttendanceSchema);
