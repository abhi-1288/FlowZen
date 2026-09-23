import { Schema, model, models, type InferSchemaType } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 40, index: true },
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
    securityJoinCode: { type: String, unique: true, sparse: true, index: true },
    juniorSecurityJoinCode: { type: String, unique: true, sparse: true, index: true },
    itAdminJoinCode: { type: String, unique: true, sparse: true, index: true },
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
    primaryColor: { type: String, default: "#2563eb" },
    address: { type: String, default: "", maxlength: 500 },
    supportEmail: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    tagline: { type: String, default: "", maxlength: 150 },
    about: { type: String, default: "", maxlength: 2000 },
    mission: { type: String, default: "", maxlength: 1000 },
    multiOffice: { type: Boolean, default: false },
    addressManagers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    regionMaxHrs: { type: Number, default: 5 },
    regionMaxAdmins: { type: Number, default: 2 },
    addresses: [{
      label: { type: String, default: "" },
      line1: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
      country: { type: String, default: "" },
      isMain: { type: Boolean, default: false },
      hrs: [{ type: Schema.Types.ObjectId, ref: "User" }],
      admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
      hrHead: { type: Schema.Types.ObjectId, ref: "User" },
      adminHead: { type: Schema.Types.ObjectId, ref: "User" },
      maxHrs: { type: Number, default: null },
      maxAdmins: { type: Number, default: null },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" }
    }],
    startDate: { type: Date, default: null },
    requiredDocuments: [{
      name: { type: String, required: true },
      mandatory: { type: Boolean, default: false },
      acceptedFileTypes: [{ type: String }],
      fields: [{ label: { type: String, required: true }, type: { type: String, default: "text" } }]
    }],
    identityCodeDigits: { type: Number, default: null },
    identityCodeStartRange: { type: Number, default: null },
    identityCodeEndRange: { type: Number, default: null },
    identityCodeNextNumber: { type: Number, default: null },
    identityCodePrefix: { type: String, default: "" },
    identityCodeReleased: [{
      code: { type: String, required: true },
      exitDate: { type: Date, default: null },
      releaseDate: { type: Date, default: null },
    }],
    identityCodeRegions: [{
      region: { type: String, required: true },
      startRange: { type: Number, required: true },
      endRange: { type: Number, required: true },
      nextNumber: { type: Number, required: true },
    }],
    stageOrder: {
      type: [String],
      default: ["applied", "screening", "assessment", "technical-interview", "manager-round", "hr-round", "offer", "joined", "ats-rejected", "rejected"],
    }
  },
  { timestamps: true }
);

export type CompanyDocument = InferSchemaType<typeof CompanySchema>;
if (process.env.NODE_ENV === "development") {
  delete models.Company;
}

export const Company = models.Company || model("Company", CompanySchema);
