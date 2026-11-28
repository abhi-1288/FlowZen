import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmMemberSchema = new Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "member" },
    team: { type: String, default: "" },
    userId: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: false },
);

CrmMemberSchema.index({ owner: 1, createdAt: -1 });

export type CrmMemberDocument = InferSchemaType<typeof CrmMemberSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmMember;
}

export const CrmMember = models.CrmMember || model("CrmMember", CrmMemberSchema);
