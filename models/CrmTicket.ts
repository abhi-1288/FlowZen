import { Schema, model, models, type InferSchemaType } from "mongoose";

const CrmTicketMessageSchema = new Schema(
  { id: { type: String }, sender: { type: String, default: "" }, role: { type: String, default: "" }, isInternal: { type: Boolean, default: false }, time: { type: String, default: "" }, text: { type: String, default: "" } },
  { _id: false },
);

const CrmTicketSchema = new Schema(
  {
    code: { type: String, default: "", trim: true },
    subject: { type: String, default: "", trim: true },
    contact: { type: Schema.Types.ObjectId, ref: "CrmContact" },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany" },
    category: { type: String, default: "General" },
    priority: { type: String, default: "Medium" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "Open" },
    agent: { type: Schema.Types.ObjectId, ref: "User" },
    messages: { type: [CrmTicketMessageSchema], default: [] },
  },
  { timestamps: true, strict: false },
);

CrmTicketSchema.index({ code: 1 });
CrmTicketSchema.index({ status: 1 });

export type CrmTicketDocument = InferSchemaType<typeof CrmTicketSchema>;

if (process.env.NODE_ENV === "development") {
  delete models.CrmTicket;
}

export const CrmTicket = models.CrmTicket || model("CrmTicket", CrmTicketSchema);
