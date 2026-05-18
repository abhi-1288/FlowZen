import { Schema, model, models, type InferSchemaType } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    joinCode: { type: String, required: true, unique: true, index: true },
    otherJoinCode: { type: String, unique: true, sparse: true, index: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export type CompanyDocument = InferSchemaType<typeof CompanySchema>;
export const Company = models.Company || model("Company", CompanySchema);
