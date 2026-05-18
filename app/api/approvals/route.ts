import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { JoinRequest } from "@/models/JoinRequest";

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

  const requests = await JoinRequest.find({ approver: userId, status: "pending" })
    .populate("requester", "name email role")
    .populate("company", "name joinCode")
    .populate("team", "name joinCode")
    .sort({ createdAt: -1 });

  return NextResponse.json({ requests: serializeDocs(requests) });
}
