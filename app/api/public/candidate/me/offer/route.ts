import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { jsonError, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  const body = await request.json();
  const { action } = body;
  if (!action || !["accept", "reject"].includes(action)) {
    return jsonError("action must be 'accept' or 'reject'.", 400);
  }

  const hash = createHash("sha256").update(token).digest("hex");

  await connectDb();

  const candidate = await ATSCandidate.findOne({
    magicTokenHash: hash,
    magicTokenExpiresAt: { $gt: new Date() },
  });

  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const offer = await ATSOffer.findOne({ candidate: candidate._id, company: candidate.company })
    .sort({ createdAt: -1 })
    .populate("job", "title");

  if (!offer) return jsonError("No offer found.", 404);
  if (offer.status === "accepted" || offer.status === "rejected") return jsonError("Offer is not in a pending state.", 400);

  if (action === "accept") {
    offer.status = "accepted";
    await offer.save();

    candidate.stage = "joined";
    await candidate.save();

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "offer-accepted",
      metadata: { offerId: offer._id, offeredCTC: offer.offeredCTC },
      company: candidate.company,
    });

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "joined",
      metadata: { joinedDate: offer.joiningDate },
      company: candidate.company,
    });

    const hrUsers = await User.find({ company: candidate.company, role: { $in: ["human-resource", "admin"] } });
    for (const hr of hrUsers) {
      await Notification.create({
        user: hr._id,
        type: "info",
        title: "Offer Accepted",
        message: `${candidate.firstName} ${candidate.lastName} has accepted the offer.`,
      });
      emitToUser(String(hr._id), "notification:new", { message: "Offer accepted notification." });
    }
  } else {
    offer.status = "rejected";
    await offer.save();

    await ATSTimeline.create({
      candidate: candidate._id,
      job: candidate.job,
      action: "offer-rejected",
      metadata: { offerId: offer._id },
      company: candidate.company,
    });
  }

  return NextResponse.json({ offer: serializeDoc(offer) });
}
