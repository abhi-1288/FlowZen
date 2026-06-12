import { Schema, model, models, type InferSchemaType } from "mongoose";

const TeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    manager: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    joinCode: { type: String, required: true, unique: true, index: true },
    otherJoinCode: { type: String, unique: true, sparse: true, index: true },
    employees: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export type TeamDocument = InferSchemaType<typeof TeamSchema>;
export const Team = models.Team || model("Team", TeamSchema);
