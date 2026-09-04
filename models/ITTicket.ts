import { Schema, model, models, type InferSchemaType } from "mongoose";

const CommentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const ActivitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { timestamps: true },
);

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const ITTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    category: {
      type: String,
      enum: [
        "ACCOUNT_LOGIN",
        "ACCESS_PERMISSION",
        "HARDWARE",
        "SOFTWARE",
        "NETWORK",
        "EMAIL",
        "PRINTER_PERIPHERAL",
        "SECURITY",
        "ACCOUNT_CREATION",
        "OTHER",
      ],
      default: "OTHER",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ASSIGNED",
        "QUEUED",
        "IN_PROGRESS",
        "WAITING_FOR_USER",
        "AWAITING_CONFIRMATION",
        "RESOLVED",
        "CANCELLED",
      ],
      default: "PENDING",
      index: true,
    },

    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    department: { type: String, default: "" },
    manager: { type: Schema.Types.ObjectId, ref: "User", default: null },

    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },

    itTeam: { type: Schema.Types.ObjectId, ref: "Team", default: null },

    resolution: { type: String, default: "", maxlength: 5000 },
    resolutionType: {
      type: String,
      enum: [
        "ACCESS_CORRECTED",
        "HARDWARE_REPAIRED",
        "SOFTWARE_INSTALLED",
        "CONFIGURATION_CHANGED",
        "PASSWORD_ACCOUNT_FIXED",
        "NETWORK_ISSUE_FIXED",
        "USER_GUIDEANCE",
        "OTHER",
      ],
      default: null,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    employeeConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },

    cancelReason: { type: String, default: "" },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },

    comments: { type: [CommentSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    activity: { type: [ActivitySchema], default: [] },

    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  },
  { timestamps: true },
);

ITTicketSchema.index({ company: 1, status: 1, createdAt: -1 });
ITTicketSchema.index({ company: 1, requester: 1 });
ITTicketSchema.index({ company: 1, priority: 1, status: 1 });

export type ITTicketDocument = InferSchemaType<typeof ITTicketSchema>;
if (process.env.NODE_ENV === "development") {
  delete models.ITTicket;
}

export const ITTicket = models.ITTicket || model("ITTicket", ITTicketSchema);
