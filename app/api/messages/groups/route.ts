import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Message } from "@/models/Message";
import { isUserOnline } from "@/lib/socket-emit";

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

  const user = await User.findById(userId).select("company companyStatus");
  if (!user?.company || user.companyStatus !== "approved") {
    return NextResponse.json({ groups: [] });
  }

  const teams = await Team.find({
    company: user.company,
    $or: [
      { manager: userId },
      { employees: userId },
    ],
  })
    .select("name company manager employees")
    .populate({ path: "employees", select: "name email role avatarUrl lastOnline companyIdentityCode" })
    .populate({ path: "manager", select: "name email role avatarUrl lastOnline companyIdentityCode" });

  const groups = await Promise.all(
    teams.map(async (team) => {
      const memberIds = [
        String(team.manager._id ?? team.manager),
        ...team.employees.map((e: any) => String(e._id ?? e)),
      ];

      const lastMessage = await Message.findOne({ group: team._id })
        .sort({ createdAt: -1 })
        .select("message createdAt sender");

      const unreadCount = await Message.countDocuments({
        group: team._id,
        sender: { $ne: userId },
        "groupReadBy.user": { $ne: userId },
      });

      const members = [
        {
          id: String(team.manager._id ?? team.manager),
          name: String(team.manager.name ?? ""),
          email: String(team.manager.email ?? ""),
          role: String(team.manager.role ?? ""),
          avatarUrl: (team.manager as any).avatarUrl ?? null,
          lastOnline: (team.manager as any).lastOnline ?? null,
          isOnline: isUserOnline(String(team.manager._id ?? team.manager)),
          isManager: true,
        },
        ...team.employees.filter((e: any) => String(e._id) !== String(team.manager._id ?? team.manager)).map((e: any) => ({
          id: String(e._id),
          name: String(e.name ?? ""),
          email: String(e.email ?? ""),
          role: String(e.role ?? ""),
          avatarUrl: e.avatarUrl ?? null,
          lastOnline: e.lastOnline ?? null,
          isOnline: isUserOnline(String(e._id)),
          isManager: false,
        })),
      ];

      return {
        id: String(team._id),
        name: team.name,
        memberCount: memberIds.length,
        members,
        lastMessage: lastMessage
          ? {
              message: lastMessage.message,
              createdAt: lastMessage.createdAt,
              sender: String(lastMessage.sender),
            }
          : null,
        unreadCount,
      };
    })
  );

  groups.sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return NextResponse.json({ groups });
}
