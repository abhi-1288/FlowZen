import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { GameChallenge } from "@/models/GameChallenge";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { GAMES } from "@/lib/games-catalog";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid challenge id.", 400);

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  await connectDb();

  const user = await User.findById(userId).select("name company companyStatus");
  if (!user) return jsonError("User not found.", 404);

  const challenge = await GameChallenge.findById(id);
  if (!challenge) return jsonError("Challenge not found.", 404);
  const isParty =
    String(challenge.from) === userId || String(challenge.to) === userId;
  if (!isParty) return jsonError("You are not part of this challenge.", 403);

  const meta = GAMES.find((g) => g.id === String(challenge.game));

  if (action === "accepted" || action === "declined") {
    if (String(challenge.to) !== userId) {
      return jsonError("Only the recipient can accept or decline.", 403);
    }
    if (String(challenge.status) !== "pending") {
      return jsonError("Challenge already responded to.", 409);
    }
    challenge.status = action === "accepted" ? "accepted" : "declined";
    challenge.read = true;
    await challenge.save();

    await Notification.create({
      user: challenge.from,
      company: challenge.company,
      type: "info",
      title: action === "accepted" ? "Challenge accepted" : "Challenge declined",
      message:
        action === "accepted"
          ? `${user.name} accepted your challenge on ${meta?.name ?? String(challenge.game)}.`
          : `${user.name} declined your challenge on ${meta?.name ?? String(challenge.game)}.`,
      link: "/profile/games",
    });
    emitNotification(String(challenge.from));

    return NextResponse.json({
      ok: true,
      challenge: { id: String(challenge._id), status: challenge.status },
    });
  }

  if (action === "poke-back") {
    const otherId = String(challenge.from) === userId ? String(challenge.to) : String(challenge.from);
    if (String(challenge.status) !== "pending" && String(challenge.to) === userId) {
      challenge.status = "accepted";
      challenge.read = true;
      await challenge.save();
    }
    const poke = await GameChallenge.create({
      from: userId,
      to: otherId,
      company: challenge.company,
      game: challenge.game,
      score: Number(challenge.score ?? 0),
      message: "Poke back! Beat this.",
      status: "pending",
    });
    await Notification.create({
      user: otherId,
      company: challenge.company,
      type: "info",
      title: "Poke back",
      message: `${user.name} poked you back on ${meta?.name ?? String(challenge.game)}. Your move!`,
      link: "/profile/games",
    });
    emitNotification(String(otherId));

    return NextResponse.json({ ok: true, challenge: { id: String(poke._id), status: "pending" } });
  }

  return jsonError("Invalid action.", 400);
}
