import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";

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
    return NextResponse.json({ members: [] });
  }

  const members = await User.find({
    company: user.company,
    companyStatus: "approved",
    _id: { $ne: user._id },
  })
    .select("name email role teamStatus")
    .sort({ role: 1, name: 1 });

  return NextResponse.json({ members: serializeDocs(members) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const recipientId = String(body.recipientId ?? "");
  const message = String(body.message ?? "").trim();
  if (!recipientId || !message) return jsonError("Member and message are required.");
  if (message.length > 1000) return jsonError("Message must be 1000 characters or less.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const [sender, recipient] = await Promise.all([
    User.findById(userId),
    User.findById(recipientId),
  ]);
  if (!sender) return jsonError("Sender not found.", 404);
  if (!recipient) return jsonError("Recipient not found.", 404);
  if (!sender.company || sender.companyStatus !== "approved") {
    return jsonError("Join a company before sending messages.", 403);
  }
  if (String(recipient.company ?? "") !== String(sender.company) || recipient.companyStatus !== "approved") {
    return jsonError("You can only message approved members in your company.", 403);
  }

  await Notification.create({
    user: recipient._id,
    company: sender.company,
    type: "info",
    title: `Message from ${sender.name}`,
    message,
    body: `${sender.name}: ${message}`,
  });
  emitNotification(String(recipient._id));

  return NextResponse.json({ ok: true });
}
