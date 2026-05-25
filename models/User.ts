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
      enum: ["employee", "project-manager", "qa-tester", "human-resource", "finance", "admin", "others"],
      default: "employee",
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
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
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.User;
}

export const User = models.User || model("User", UserSchema);


