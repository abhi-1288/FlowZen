import { Schema, model, models } from "mongoose";

const HolidaySchema = new Schema(
  {
    title: { type: String, required: true, default: "Company Holiday" },
    description: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true }
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === "development") {
  delete (models as any).Holiday;
}

export const Holiday = models.Holiday || model("Holiday", HolidaySchema);
