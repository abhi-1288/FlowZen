import { Schema, model, models, type InferSchemaType } from "mongoose";

const StockMovementSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    item: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true, index: true },
    productNumber: { type: String, default: "", trim: true, uppercase: true },
    batchNumber: { type: String, default: "", trim: true, uppercase: true },
    name: { type: String, default: "", trim: true },
    category: { type: String, default: "other" },
    unit: { type: String, default: "piece" },
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "transfer"],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, default: 0 },
    newStock: { type: Number, default: 0 },
    reference: {
      type: String,
      enum: ["store-order", "manual", "transfer", "return"],
      default: "manual",
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    sourceLocation: { type: String, default: "", trim: true },
    destinationLocation: { type: String, default: "", trim: true },
    notes: { type: String, default: "", maxlength: 500 },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    regionLabel: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true },
);

StockMovementSchema.index({ company: 1, createdAt: -1 });
StockMovementSchema.index({ company: 1, item: 1, createdAt: -1 });
StockMovementSchema.index({ company: 1, type: 1, createdAt: -1 });
StockMovementSchema.index({ company: 1, regionLabel: 1, createdAt: -1 });

export type StockMovementDocument = InferSchemaType<typeof StockMovementSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.StockMovement;
}

export const StockMovement = models.StockMovement || model("StockMovement", StockMovementSchema);