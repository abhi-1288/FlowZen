import { Schema, model, models, type InferSchemaType } from "mongoose";

const ColumnSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    order: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

ColumnSchema.index({ board: 1, order: 1 });

export type ColumnDocument = InferSchemaType<typeof ColumnSchema>;
export const Column = models.Column || model("Column", ColumnSchema);
