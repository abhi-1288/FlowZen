import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ["employee", "project-manager", "qa-tester", "human-resource", "finance", "admin", "security", "it-admin", "it-administration", "others"],
      default: "employee",
      index: true,
    },
    isSeniorSecurity: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    pendingEmail: { type: String, lowercase: true, trim: true, default: null },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, default: null, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    passwordResetRequired: { type: Boolean, default: false },
    authProvider: {
      type: String,
      enum: [
        "credentials",
        "google",
        "microsoft",
        "apple",
        "github",
        "discord",
      ],
      default: "credentials",
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
    activeTeams: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    membershipHistory: [
      {
        company: { type: Schema.Types.ObjectId, ref: "Company", default: null },
        team: { type: Schema.Types.ObjectId, ref: "Team", default: null },
        board: { type: Schema.Types.ObjectId, ref: "Board", default: null },
        inviter: { type: Schema.Types.ObjectId, ref: "User", default: null },
        invitee: { type: Schema.Types.ObjectId, ref: "User", default: null },
        action: {
          type: String,
          enum: [
            "joined-company",
            "joined-team",
            "switched-team",
            "removed-team",
            "removed-company",
            "left-company",
            "left-team",
            "board-invite",
            "board-remove",
            "contract-expired",
          ],
          required: true,
        },
        at: { type: Date, default: Date.now },
      },
    ],

    companyJoined: {
      type: Date,
      // default: Date.now,
      default: null,
    },

    employmentEndDate: { type: Date, default: null },
    employmentType: { type: String, default: "" },
    durationMonths: { type: Number, default: null },
    durationDays: { type: Number, default: null },
    durationHours: { type: Number, default: null },
    durationYears: { type: Number, default: null },

    // Pay basis for finance engine. "per-annum" and "per-month" use baseSalary
    // in the monthly payroll; "per-hour" uses hourlyRate; "per-day" uses dailyRate.
    salaryType: {
      type: String,
      enum: ["per-annum", "per-month", "per-day", "per-hour"],
      default: "per-annum",
    },
    hourlyRate: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },

    teamJoined: {
      type: Date,
      // default: Date.now,
      default: null,
    },

    companyStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    teamStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    avatarUrl: { type: String, default: "" },
    customRole: { type: String, default: "", trim: true, maxlength: 80 },
    companyIdentityCode: { type: String, trim: true, unique: true, sparse: true, index: true },
    baseSalary: { type: Number, default: 0 },
    salaryCurrency: { type: String, default: "INR", trim: true },
    pfNumber: { type: String, default: "" },
    pfDeductionAmount: { type: Number, default: 0 },
    esicNumber: { type: String, default: "" },
    esicDeductionAmount: { type: Number, default: 0 },
    tdsDeductionAmount: { type: Number, default: 0 },
    pfExempted: { type: Boolean, default: false },
    esicExempted: { type: Boolean, default: false },
    tdsExempted: { type: Boolean, default: false },
    salaryHistory: [
      {
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        type: { type: String, default: "increment" }
      }
    ],
    documents: [{
      category: { type: String, required: true },
      fileName: { type: String, required: true },
      fileType: { type: String, required: true },
      fileSize: { type: Number, required: true },
      fileUrl: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      fieldValues: [{ label: { type: String }, value: { type: String } }],
    }],
    roleHistory: [
      {
        oldRole: { type: String, required: true },
        newRole: { type: String, required: true },
        changedBy: { type: String, default: "" },
        changedAt: { type: Date, default: Date.now },
      }
    ],
    lastOnline: { type: Date, default: null },
    phone: { type: String, default: "", trim: true, maxlength: 20 },
    dob: { type: Date, default: null },
    address: { type: String, default: "", trim: true, maxlength: 500 },
    regionLabel: { type: String, default: "", trim: true },
    emergencyContact: { type: String, default: "", trim: true, maxlength: 20 },
    bloodGroup: { type: String, default: "", trim: true, maxlength: 5 },
    bankAccountNumber: { type: String, default: "", trim: true },
    ifscCode: { type: String, default: "", trim: true },
    maskPhone: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.User;
}

export const User = models.User || model("User", UserSchema);


