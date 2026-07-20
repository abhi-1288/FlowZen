import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Message } from "@/models/Message";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

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

  const directUnread = await Message.countDocuments({
    recipient: userId,
    readAt: null,
  });

  const user = await User.findById(userId).select("company companyStatus");
  let groupUnread = 0;

  if (user?.company && user.companyStatus === "approved") {
    const teams = await Team.find({
      company: user.company,
      $or: [
        { manager: userId },
        { employees: userId },
      ],
    }).select("_id");

    if (teams.length > 0) {
      const teamIds = teams.map((t) => t._id);
      groupUnread = await Message.countDocuments({
        group: { $in: teamIds },
        sender: { $ne: userId },
        "groupReadBy.user": { $ne: userId },
      });
    }
  }

  return NextResponse.json({ unreadCount: directUnread + groupUnread });
}
