import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { User } from "@/models/User";
import { ClientInvoice } from "@/models/ClientInvoice";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { ProjectBudget } from "@/models/ProjectBudget";
import { StoreOrder } from "@/models/StoreOrder";
import { ITTicket } from "@/models/ITTicket";
import { VisitorPass } from "@/models/VisitorPass";
import { AttendanceExportRequest } from "@/models/AttendanceExportRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { LostCardReport } from "@/models/LostCardReport";

const MODELS: Record<string, any> = { invoice: ClientInvoice, expense: ExpenseRequest, budget: ProjectBudget, order: StoreOrder, ticket: ITTicket, visitorPass: VisitorPass, attendanceExport: AttendanceExportRequest, salary: FinanceSalary, provisioning: ITProvisioningRequest, joiningCode: ITJoiningCode, lostCard: LostCardReport };

/** Shared verifier for every persisted delegated workflow. Individual action
 * routes defer their mutation by setting the standard verification fields. */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const { kind, id } = await params;
  const Model = MODELS[kind];
  if (!Model) return jsonError("Unknown verification workflow.", 404);
  await connectDb();
  const actor = await User.findById(userId).select("company role");
  if (!actor?.company) return jsonError("Company access is required.", 403);
  const row = await Model.findOne({ _id: id, company: actor.company });
  if (!row) return jsonError("Submission not found.", 404);
  if (row.verificationStatus !== "pending-verification") return jsonError("This submission is not pending verification.", 400);
  if (String(row.submittedBy) === userId) return jsonError("You cannot verify your own submission.", 403);
  if (String(row.authorizer) !== userId && !["admin", "human-resource"].includes(String(actor.role))) return jsonError("Only the authorizer can verify this submission.", 403);
  row.verificationStatus = "verified"; row.verifiedBy = userId; row.verifiedAt = new Date();
  // A joining code is inert until its authorizer verifies it; unlike request
  // records, it has an immediately usable capability to release.
  if (kind === "joiningCode") row.status = "active";
  await row.save();
  return NextResponse.json({ submission: serializeDoc(row) });
}
