import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { ITTicket } from "@/models/ITTicket";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view IT team.", 403);
  }
  const companyId =
    typeof actor.company === "object" && actor.company ? (actor.company as any)._id : actor.company;

  const itAdmins = await User.find({
    company: companyId,
    role: "it-admin",
    companyStatus: "approved",
  })
    .select("name email role avatarUrl")
    .sort({ name: 1 });

  const itStaff = await User.find({
    company: companyId,
    role: "it-administration",
    companyStatus: "approved",
  })
    .select("name email role avatarUrl activeTeams team")
    .sort({ name: 1 });

  // Workload: open (non-resolved, non-cancelled) tickets per member.
  const openTickets = await ITTicket.find({
    company: companyId,
    status: { $nin: ["RESOLVED", "CANCELLED"] },
    assignedTo: { $ne: null },
  }).select("assignedTo status priority");

  const workload: Record<string, { total: number; inProgress: number; urgent: number }> = {};
  for (const t of openTickets) {
    const key = String(t.assignedTo);
    workload[key] = workload[key] ?? { total: 0, inProgress: 0, urgent: 0 };
    workload[key].total += 1;
    if (t.status === "IN_PROGRESS" || t.status === "WAITING_FOR_USER") workload[key].inProgress += 1;
    if (t.priority === "URGENT") workload[key].urgent += 1;
  }

  return NextResponse.json({
    itAdmins: itAdmins.map((u) => ({ id: String(u._id), name: u.name, email: u.email, avatarUrl: u.avatarUrl ?? "" })),
    itStaff: itStaff.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? "",
      workload: workload[String(u._id)] ?? { total: 0, inProgress: 0, urgent: 0 },
      activeTeams: Array.isArray((u as any).activeTeams) ? (u as any).activeTeams.length : 0,
    })),
  });
}
