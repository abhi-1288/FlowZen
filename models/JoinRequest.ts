import { Schema, model, models, type InferSchemaType } from "mongoose";

const JoinRequestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approver: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    team: { type: Schema.Types.ObjectId, ref: "Team", default: null, index: true },
    replacementHr: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    replacementUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    kind: { type: String, enum: ["company", "team", "identity-code", "salary", "quit-company", "quit-team", "quit-company-board-transfer"], required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    noticeEndedNotifiedAt: { type: Date, default: null, index: true },
    cancelReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

JoinRequestSchema.index({ requester: 1, kind: 1, status: 1 });

export type JoinRequestDocument = InferSchemaType<typeof JoinRequestSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.JoinRequest;
}

export const JoinRequest = models.JoinRequest || model("JoinRequest", JoinRequestSchema);
