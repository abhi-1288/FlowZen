import { Schema, model, models, type InferSchemaType } from "mongoose";

const WarehouseItemSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    category: {
      type: String,
      enum: ["laptop", "desktop"],
      required: true,
      index: true,
    },
    model: { type: String, required: true, trim: true, maxlength: 160 },
    stock: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

WarehouseItemSchema.index({ company: 1, category: 1, model: 1 }, { unique: true });

export type WarehouseItemDocument = InferSchemaType<typeof WarehouseItemSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.WarehouseItem;
}

export const WarehouseItem =
  models.WarehouseItem || model("WarehouseItem", WarehouseItemSchema);