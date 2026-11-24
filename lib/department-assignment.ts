import { connectDb } from "@/lib/db";
import { createJoinCode, createRoleJoinCode } from "@/lib/codes";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

/**
 * File a member under a department and make them its head. Shared by the
 * direct admin-head path and the approval path so both do exactly the same
 * thing: set `user.department`, create/attach the department team, and put the
 * requester in charge of it.
 */
export async function assignDepartmentHead(
  companyId: unknown,
  requesterId: unknown,
  department: string,
) {
  await connectDb();

  await User.updateOne({ _id: requesterId }, { $set: { department } });

  let team = await Team.findOne({ company: companyId, name: department });
  if (!team) {
    const joinCode = createJoinCode("TM");
    team = await Team.create({
      name: department,
      company: companyId,
      manager: requesterId,
      createdBy: requesterId,
      joinCode,
      otherJoinCode: createRoleJoinCode(joinCode),
      employees: [requesterId],
      isDepartment: true,
    });
  } else {
    let changed = false;
    // Older department teams pre-date this flag; adopt them so deletion can
    // never confuse them with a normal team of the same name.
    if (!team.isDepartment) {
      team.isDepartment = true;
      changed = true;
    }
    if (String(team.manager) !== String(requesterId)) {
      team.manager = requesterId;
      if (!Array.isArray(team.employees)) team.employees = [];
      if (!team.employees.some((id: any) => String(id) === String(requesterId))) {
        team.employees.push(requesterId);
      }
      changed = true;
    }
    if (changed) await team.save();
  }

  await User.updateOne(
    { _id: requesterId },
    { $set: { department, team: team._id, teamStatus: "approved" } },
  );

  return team;
}
