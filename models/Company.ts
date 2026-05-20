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
    employeeJoinCode: { type: String, unique: true, sparse: true, index: true },
    otherJoinCode: { type: String, unique: true, sparse: true, index: true },
    noticePeriodDays: { type: Number, default: 30 },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export type CompanyDocument = InferSchemaType<typeof CompanySchema>;
if (process.env.NODE_ENV === "development") {
  delete models.Company;
}

export const Company = models.Company || model("Company", CompanySchema);
