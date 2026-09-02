import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { GameChallenge } from "@/models/GameChallenge";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { GAMES } from "@/lib/games-catalog";

export async function POST(request: Request) {
  const fromId = await requireUserId();
  if (!fromId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const gameId = String(body.game ?? "");
  const toId = String(body.to ?? "");
  const score = Number(body.score ?? 0);
  const message = String(body.message ?? "").slice(0, 300);

  if (!GAMES.some((g) => g.id === gameId)) return jsonError("Invalid game.", 400);
  if (!toId || toId === fromId) return jsonError("Invalid challenge target.", 400);

  await connectDb();

  const [fromUser, toUser] = await Promise.all([
    User.findById(fromId).select("name company companyStatus"),
    User.findById(toId).select("name company companyStatus"),
  ]);
  if (!fromUser) return jsonError("User not found.", 404);
  if (!toUser) return jsonError("Challenge target not found.", 404);
  if (!fromUser.company || String(fromUser.companyStatus) !== "approved") {
    return jsonError("You must be an approved company member to challenge.", 403);
  }
  if (
    !toUser.company ||
    String(toUser.companyStatus) !== "approved" ||
    String(toUser.company) !== String(fromUser.company)
  ) {
    return jsonError("You can only challenge members of your company.", 400);
  }

  const challenge = await GameChallenge.create({
    from: fromId,
    to: toId,
    company: fromUser.company,
    game: gameId,
    score: Number.isFinite(score) && score >= 0 ? Math.round(score) : 0,
    message,
    status: "pending",
  });

  const meta = GAMES.find((g) => g.id === gameId);
  await Notification.create({
    user: toId,
    company: fromUser.company,
    type: "info",
    title: "Game challenge",
    message: `${fromUser.name} challenged you on ${meta?.name ?? gameId}. Beat their score!`,
    link: "/profile/games",
  });
  emitNotification(String(toId));

  return NextResponse.json({
    ok: true,
    challenge: {
      id: String(challenge._id),
      game: challenge.game,
      score: challenge.score,
      status: challenge.status,
    },
  });
}
