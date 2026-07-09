import { Schema, model, models, type InferSchemaType } from "mongoose";

const timelineEntrySchema = new Schema(
  {
    action: { type: String, required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const LostCardReportSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedByEmployee: { type: Boolean, default: false },

    status: {
      type: String,
      enum: [
        "reported",
        "under-verification",
        "replacement-approved",
        "card-disabled",
        "hr-approved",
        "printing",
        "ready-for-pickup",
        "completed",
        "rejected",
        "found",
        "found-after-replacement",
      ],
      default: "reported",
      index: true,
    },

    // Step 1: Report details
    reason: {
      type: String,
      enum: ["lost", "stolen", "damaged", "not-working"],
      default: "lost",
    },
    lastLocation: { type: String, default: "" },
    lostDateTime: { type: Date, default: null },
    policeComplaintNumber: { type: String, default: "" },
    isEmergency: { type: Boolean, default: false },
    notes: { type: String, default: "" },

    // Step 2: Security verification
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    verificationNotes: { type: String, default: "" },

    // Step 3: Replacement approved
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },

    // Step 4: Access disabled
    cardDisabledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cardDisabledAt: { type: Date, default: null },
    disabledZones: { type: [String], default: [] },

    // Step 5: HR approval
    hrApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    hrApprovedAt: { type: Date, default: null },

    // Step 6: Printing
    newCardNumber: { type: String, default: "" },
    newRfidUid: { type: String, default: "" },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    printedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    printedAt: { type: Date, default: null },

    // Step 7: Collection
    collectedAt: { type: Date, default: null },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    collectionVerificationMethod: { type: String, default: "" },

    // Assignment & SLA
    assignedSecurity: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expectedCompletion: { type: Date, default: null },

    // Ticket / assignment flow
    assignedSeniorSecurity: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedHR: { type: Schema.Types.ObjectId, ref: "User", default: null },
    seniorTicketOpened: { type: Boolean, default: false },
    seniorTicketOpenedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    seniorTicketOpenedAt: { type: Date, default: null },
    assignedJuniorSecurity: { type: Schema.Types.ObjectId, ref: "User", default: null },
    juniorAcceptedAt: { type: Date, default: null },
    followUpNotes: { type: [{ note: String, addedBy: { type: Schema.Types.ObjectId, ref: "User" }, addedByName: String, addedAt: { type: Date, default: Date.now } }], default: [] },
    juniorCompletedAt: { type: Date, default: null },

    // Found card logic
    oldCardFound: { type: Boolean, default: false },
    replacementAlreadyIssued: { type: Boolean, default: false },
    oldCardDestroyed: { type: Boolean, default: false },

    // Rejection
    rejectionReason: { type: String, default: "" },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },

    // Timeline
    timeline: { type: [timelineEntrySchema], default: [] },
  },
  { timestamps: true }
);

LostCardReportSchema.index({ company: 1, status: 1 });
LostCardReportSchema.index({ company: 1, user: 1 });
LostCardReportSchema.index({ company: 1, assignedSecurity: 1 });

export type LostCardReportDocument = InferSchemaType<typeof LostCardReportSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).LostCardReport;
}

export const LostCardReport = models.LostCardReport || model("LostCardReport", LostCardReportSchema);
