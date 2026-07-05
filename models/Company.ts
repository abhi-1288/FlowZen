import { Schema, model, models, type InferSchemaType } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    joinCode: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["active", "frozen", "taken-down"], default: "active" },
    hrJoinCode: { type: String, unique: true, sparse: true, index: true },
    managerJoinCode: { type: String, unique: true, sparse: true, index: true },
    testerJoinCode: { type: String, unique: true, sparse: true, index: true },
    financeJoinCode: { type: String, unique: true, sparse: true, index: true },
    employeeJoinCode: { type: String, unique: true, sparse: true, index: true },
    otherJoinCode: { type: String, unique: true, sparse: true, index: true },
    adminJoinCode: { type: String, unique: true, sparse: true, index: true },
    noticePeriodDays: { type: Number, default: 30 },
    paidLeaveDays: { type: Number, default: 0 },
    paidLeavePeriod: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    wfhDays: { type: Number, default: 0 },
    wfhPeriod: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    wfhDates: [
      {
        date: { type: Date, index: true },
        reason: { type: String }
      }
    ],
    weekendDates: [
      {
        date: { type: Date, index: true },
        reason: { type: String }
      }
    ],
    carryForwardLeaveDays: { type: Boolean, default: false },
    carryForwardWfhDays: { type: Boolean, default: false },
    wfhCheckInMode: { type: String, enum: ["all-day", "wfh-only"], default: "all-day" },
    minWorkHours: { type: Number, default: 8 },
    icon: { type: String, default: "" },
    address: { type: String, default: "", maxlength: 500 },
    startDate: { type: Date, default: null },
    requiredDocuments: [{
      name: { type: String, required: true },
      mandatory: { type: Boolean, default: false },
      acceptedFileTypes: [{ type: String }],
      fields: [{ label: { type: String, required: true }, type: { type: String, default: "text" } }]
    }]
  },
  { timestamps: true }
);

export type CompanyDocument = InferSchemaType<typeof CompanySchema>;
if (process.env.NODE_ENV === "development") {
  delete models.Company;
}

export const Company = models.Company || model("Company", CompanySchema);
