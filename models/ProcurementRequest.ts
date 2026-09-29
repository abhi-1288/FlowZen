import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Company purchase requests for hardware, software, connectivity and office
 * electronics. This is the IT-side record: it is raised from `/profile/it`,
 * reviewed by `it-admin` / `it-administration`, and — once approved — mints a
 * linked `ExpenseRequest` for the finance leg to accept and disburse.
 *
 * Travel never lands here; it stays a plain `ExpenseRequest` routed to finance.
 */
const ActivitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { timestamps: true },
);

const ProcurementRequestSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    requestNumber: { type: String, required: true, trim: true, uppercase: true, index: true },

    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /**
     * Display snapshot of the requester's effective region, resolved at creation
     * from `User.regionLabel` with the main-office fallback. Read-side scoping
     * still resolves against live members (see `lib/procurement.ts`) so moving a
     * member between regions correctly re-homes their tickets; this is only for
     * display and for picking the finance leg's assignee.
     */
    regionLabel: { type: String, default: "", trim: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: [
        "laptop",
        "desktop",
        "software",
        "electronics",
        "internet-service",
        "email-service",
        "office-resources",
      ],
      required: true,
      index: true,
    },
    vendor: { type: String, default: "", trim: true, maxlength: 160 },
    reason: { type: String, default: "", maxlength: 2000 },

    amount: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    currency: { type: String, default: "INR", trim: true, uppercase: true, maxlength: 8 },

    status: {
      type: String,
      enum: [
        "PENDING_IT",
        "ASSIGNED_IT",
        "IT_APPROVED",
        "ACCEPTED_FIN",
        "DISBURSED",
        "REJECTED_IT",
        "REJECTED_FIN",
        "CANCELLED",
      ],
      default: "PENDING_IT",
      index: true,
    },

    itAssignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    itAssignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    itAssignedAt: { type: Date, default: null },
    itReviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    itReviewedAt: { type: Date, default: null },
    itRejectionReason: { type: String, default: "", maxlength: 500 },

    /** Minted on IT approval; the finance leg for this purchase. */
    expense: { type: Schema.Types.ObjectId, ref: "ExpenseRequest", default: null },
    financeAssignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    financeRejectionReason: { type: String, default: "", maxlength: 500 },

    cancelReason: { type: String, default: "", maxlength: 500 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },

    activity: { type: [ActivitySchema], default: [] },
  },
  { timestamps: true },
);

ProcurementRequestSchema.index({ company: 1, requestNumber: 1 }, { unique: true });
ProcurementRequestSchema.index({ company: 1, status: 1, createdAt: -1 });
ProcurementRequestSchema.index({ company: 1, requester: 1 });
ProcurementRequestSchema.index({ company: 1, itAssignedTo: 1, status: 1 });

export type ProcurementRequestDocument = InferSchemaType<typeof ProcurementRequestSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.ProcurementRequest;
}

export const ProcurementRequest =
  models.ProcurementRequest || model("ProcurementRequest", ProcurementRequestSchema);
