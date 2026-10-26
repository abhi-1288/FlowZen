import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A cart checkout against the company store. The requester picks products,
 * a delivery name and department, and an approver (their team owner or an
 * eligible approver from the region dropdown). Stock is held at creation
 * (decremented) and restored when the order is rejected or cancelled.
 *
 * Approver flow: pending → approved → fulfilled, with reject/cancel as
 * terminal branches that restore stock.
 *
 * Delivery: once approved, the warehouse moves every line through
 * packing → out-for-delivery → delivered (see
 * app/api/store/orders/[id]/delivery/route.ts). When the last line is marked
 * delivered the order itself flips to fulfilled.
 *
 * Take-away: the warehouse first marks the order packed and ready for pickup,
 * then marks it handed over (see app/api/store/orders/[id]/takeaway/route.ts).
 *
 * Fulfilment always issues the invoice: the order number doubles as the
 * invoice number and `invoiceIssuedAt` records when it became available.
 */
const ActivitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { timestamps: true },
);

const StoreOrderItemSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true },
    productNumber: { type: String, default: "", trim: true, uppercase: true },
    batchNumber: { type: String, default: "", trim: true, uppercase: true },
    name: { type: String, default: "", trim: true },
    category: { type: String, default: "other" },
    unit: { type: String, default: "piece" },
    price: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    /**
     * Warehouse-set delivery progress for this line. Starts at `pending`
     * ("awaiting packing") when the order is approved and moves through
     * packing → out-for-delivery → delivered.
     */
    deliveryStatus: {
      type: String,
      enum: ["pending", "packing", "out-for-delivery", "delivered"],
      default: "pending",
    },
  },
  { _id: false },
);

const StoreOrderSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    orderNumber: { type: String, required: true, trim: true, index: true },

    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /**
     * Display snapshot of the requester's effective region at creation time.
     * Live scoping still resolves against members (see lib/store.ts) so moving
     * a member between regions re-homes their orders.
     */
    regionLabel: { type: String, default: "", trim: true, index: true },

    items: { type: [StoreOrderItemSchema], default: [] },

    deliveryName: { type: String, default: "", trim: true, maxlength: 120 },
    department: { type: String, default: "", trim: true, maxlength: 160 },

    /** Whether the requester collects the order or wants it delivered. */
    fulfillmentMethod: {
      type: String,
      enum: ["delivery", "takeaway"],
      default: "delivery",
      index: true,
    },
    /**
     * Take-away progress: pending → ready (packed, requester notified) →
     * handed-over. Ignored for delivery orders.
     */
    takeAwayStatus: {
      type: String,
      enum: ["pending", "ready", "handed-over"],
      default: "pending",
    },
    takeAwayReadyAt: { type: Date, default: null },
    takeAwayReadyBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    takeAwayHandedOverAt: { type: Date, default: null },
    takeAwayHandedOverBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    /** Invoice is available once this is set; number matches orderNumber. */
    invoiceIssuedAt: { type: Date, default: null },
    invoiceIssuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    status: {
      type: String,
      enum: ["pending", "approved", "fulfilled", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },

    verificationStatus: { type: String, enum: ["none", "pending-verification", "verified"], default: "none" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorizer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    pendingAction: { type: String, default: "" },
    pendingReason: { type: String, default: "" },

    approver: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: "", maxlength: 500 },
    cancelReason: { type: String, default: "", maxlength: 500 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    fulfilledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    fulfilledAt: { type: Date, default: null },

    activity: { type: [ActivitySchema], default: [] },
  },
  { timestamps: true },
);

StoreOrderSchema.index({ company: 1, orderNumber: 1 }, { unique: true });
StoreOrderSchema.index({ company: 1, status: 1, createdAt: -1 });
StoreOrderSchema.index({ company: 1, requester: 1 });
StoreOrderSchema.index({ company: 1, approver: 1, status: 1 });

export type StoreOrderDocument = InferSchemaType<typeof StoreOrderSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.StoreOrder;
}

export const StoreOrder = models.StoreOrder || model("StoreOrder", StoreOrderSchema);
