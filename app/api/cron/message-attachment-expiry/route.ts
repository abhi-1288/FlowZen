import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Message } from "@/models/Message";
import { deleteMessageAttachment } from "@/lib/message-attachments";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();

  const now = new Date();
  const expiredMessages = await Message.find({
    "attachment.expiresAt": { $lte: now },
    "attachment.isExpired": false,
    "attachment.fileId": { $exists: true, $ne: "" },
  }).select("attachment").lean();

  let deleted = 0;

  for (const msg of expiredMessages) {
    const att = msg.attachment as any;
    if (att?.fileId && att?.provider) {
      await deleteMessageAttachment({ provider: att.provider, fileId: att.fileId, url: att.url });
      deleted++;
    }
  }

  if (deleted > 0) {
    await Message.updateMany(
      {
        _id: { $in: expiredMessages.map((m: any) => m._id) },
      },
      { $set: { "attachment.isExpired": true, "attachment.url": "", "attachment.fileId": "" } }
    );
  }

  return NextResponse.json({ ok: true, deleted });
}
