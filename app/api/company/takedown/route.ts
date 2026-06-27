import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { JoinRequest } from "@/models/JoinRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { WfhRequest } from "@/models/WfhRequest";
import { LeaveRequest } from "@/models/LeaveRequest";
import { ResourceRequest } from "@/models/ResourceRequest";
import { ClientInvoice } from "@/models/ClientInvoice";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { ExpenseBill } from "@/models/ExpenseBill";
import { ProjectBudget } from "@/models/ProjectBudget";
import { Holiday } from "@/models/Holiday";
import { Notification } from "@/models/Notification";

export async function POST() {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    try {
      await connectDb();
    } catch (error) {
      const dbError = databaseUnavailable(error);
      if (dbError) return dbError;
      throw error;
    }

    const admin = await User.findById(userId);
    if (!admin) return jsonError("User not found.", 404);
    if (admin.role !== "admin" || admin.companyStatus !== "approved" || !admin.company) {
      return jsonError("Only approved admins can take down a company.", 403);
    }

    const company = await Company.findById(admin.company);
    if (!company) return jsonError("Company not found.", 404);
    if (company.status === "taken-down") {
      return jsonError("Company has already been taken down.", 400);
    }

    const approvedMembersBesidesAdmin = await User.countDocuments({
      _id: { $ne: admin._id },
      company: company._id,
      companyStatus: "approved",
    });
    if (approvedMembersBesidesAdmin > 0) {
      return jsonError("Remove all approved members before taking down this company.", 409);
    }

    const companyId = company._id;

    const teamIds = (await Team.find({ company: companyId }, { _id: 1 }).lean()).map(
      (t) => t._id,
    );

    const userIds = (await User.find({ company: companyId }, { _id: 1 }).lean()).map(
      (u) => u._id,
    );

    const boardIds = (
      await Board.find({ owner: { $in: userIds } }, { _id: 1 }).lean()
    ).map((b) => b._id);

    await Task.deleteMany({ board: { $in: boardIds } });
    await Task.deleteMany({ takenTeam: { $in: teamIds } });
    await Column.deleteMany({ board: { $in: boardIds } });
    await Board.deleteMany({ owner: { $in: userIds } });
    await Team.deleteMany({ company: companyId });
    await JoinRequest.deleteMany({ company: companyId });
    await FinanceSalary.deleteMany({ company: companyId });
    await WfhRequest.deleteMany({ company: companyId });
    await LeaveRequest.deleteMany({ company: companyId });
    await ResourceRequest.deleteMany({ company: companyId });
    await ClientInvoice.deleteMany({ company: companyId });
    await ExpenseRequest.deleteMany({ company: companyId });
    await ExpenseBill.deleteMany({ company: companyId });
    await ProjectBudget.deleteMany({ company: companyId });
    await Holiday.deleteMany({ company: companyId });
    await Notification.deleteMany({ company: companyId });

    await User.updateMany(
      { company: companyId },
      {
        $set: { company: null, companyStatus: "none" },
        $unset: { companyIdentityCode: "" },
      },
    );

    await Company.deleteOne({ _id: companyId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to take down company.",
      500,
    );
  }
}
