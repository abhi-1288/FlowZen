import { Schema, model, models } from "mongoose";

const HolidaySchema = new Schema(
  {
    title: { type: String, required: true, default: "Company Holiday" },
    description: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    // "" = global holiday (every region); non-empty = that region only.
    region: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

HolidaySchema.index({ company: 1, region: 1 });

if (process.env.NODE_ENV === "development") {
  delete (models as any).Holiday;
}

export const Holiday = models.Holiday || model("Holiday", HolidaySchema);
