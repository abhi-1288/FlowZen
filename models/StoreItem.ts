import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * General company store/warehouse catalogue — stationery, paper, books,
 * letterheads and the other day-to-day things every employee may order.
 *
 * Scoped per region: `regionLabel` is the creator's effective region stamped
 * at creation (main-office fallback), and the catalog API only serves items
 * whose region matches the requester's effective region. A company with no
 * office configuration resolves everyone to the same label, so the whole
 * company shares one bucket out of the box.
 *
 * The IT laptop/desktop inventory stays in `WarehouseItem`; nothing in that
 * model changes for this.
 */
const StoreItemSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    regionLabel: { type: String, default: "", trim: true, index: true },
    category: {
      type: String,
      enum: [
        "stationery",
        "paper",
        "books",
        "letterhead",
        "electronics",
        "accessories",
        "office-supplies",
        "other",
      ],
      default: "other",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 500 },
    productNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    batchNumber: { type: String, default: "", trim: true, uppercase: true, maxlength: 60 },
    unit: { type: String, default: "piece", trim: true, maxlength: 40 },
    price: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

StoreItemSchema.index(
  { company: 1, regionLabel: 1, productNumber: 1 },
  { unique: true },
);
StoreItemSchema.index({ company: 1, regionLabel: 1, category: 1 });

export type StoreItemDocument = InferSchemaType<typeof StoreItemSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.StoreItem;
}

export const StoreItem = models.StoreItem || model("StoreItem", StoreItemSchema);
