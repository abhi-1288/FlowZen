import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { Message } from "@/models/Message";
import { Team } from "@/models/Team";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return jsonError("teamId is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const team = await Team.findById(teamId).select("company manager employees");
  if (!team) return jsonError("Team not found.", 404);

  const user = await User.findById(userId).select("company companyStatus");
  if (!user?.company || user.companyStatus !== "approved") {
    return jsonError("Unauthorized.", 403);
  }
  if (String(team.company) !== String(user.company)) {
    return jsonError("Team does not belong to your company.", 403);
  }

  const isMember =
    String(team.manager) === userId ||
    team.employees.some((id: any) => String(id) === userId);
  if (!isMember) return jsonError("You are not a member of this team.", 403);

  const messages = await Message.find({ group: teamId })
    .sort({ createdAt: 1 })
    .populate({ path: "sender", select: "name avatarUrl" })
    .populate({ path: "replyTo", select: "sender message", populate: { path: "sender", select: "name" } })
    .populate({ path: "reactions.user", select: "name" })
    .populate({ path: "groupReadBy.user", select: "name" });

  await Message.updateMany(
    {
      group: teamId,
      sender: { $ne: userId },
      "groupReadBy.user": { $ne: userId },
    },
    {
      $push: { groupReadBy: { user: userId, readAt: new Date() } },
    }
  );

  return NextResponse.json({ messages: serializeDocs(messages) });
}
