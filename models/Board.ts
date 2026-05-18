import { Schema, model, models, type InferSchemaType } from "mongoose";

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true }
  },
  { _id: false }
);

const BoardSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
        role: {
          type: String,
          enum: ["admin", "manager", "employee", "tester", "others"],
          default: "employee",
          lowercase: true,
          trim: true
        }
      }
    ],
    attachments: { type: [AttachmentSchema], default: [] }
  },
  { timestamps: true }
);

BoardSchema.index({ owner: 1, createdAt: -1 });
BoardSchema.index({ "members.user": 1 });

export type BoardDocument = InferSchemaType<typeof BoardSchema>;
// Force refresh by checking models.Board more strictly if needed, 
// but we'll stick to the standard pattern first with the refactored schema.
if (process.env.NODE_ENV === "development") {
  delete models.Board;
}

export const Board = models.Board || model("Board", BoardSchema);
