import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { GameScore } from "@/models/GameScore";
import { User } from "@/models/User";
import { GAMES, MAX_GAME_SCORE } from "@/lib/games-catalog";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const gameId = String(body.game ?? "");
  if (!GAMES.some((g) => g.id === gameId)) {
    return jsonError("Invalid game.", 400);
  }
  const rawScore = Number(body.score ?? 0);
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > MAX_GAME_SCORE) {
    return jsonError("Invalid score.", 400);
  }
  const score = Math.round(rawScore);

  await connectDb();

  const user = await User.findById(userId).select("company companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || String(user.companyStatus) !== "approved") {
    return jsonError("You must be an approved company member to submit a score.", 403);
  }
  const companyId = String(user.company);

  const meta = GAMES.find((g) => g.id === gameId);
  const now = new Date();

  const scoreDoc = await GameScore.findOne({ user: userId, company: companyId, game: gameId });

  if (!scoreDoc) {
    await GameScore.create({
      user: userId,
      company: companyId,
      game: gameId,
      bestScore: score,
      lastScore: score,
      plays: 1,
      bestAt: now,
    });
    return NextResponse.json({ ok: true, bestScore: score, isNewBest: true });
  }

  const lowerIsBetter = Boolean(meta?.lowerIsBetter);
  const improved = lowerIsBetter
    ? score < (scoreDoc.bestScore || Infinity)
    : score > (scoreDoc.bestScore ?? 0);

  scoreDoc.lastScore = score;
  scoreDoc.plays = (scoreDoc.plays ?? 0) + 1;
  if (improved) {
    scoreDoc.bestScore = score;
    scoreDoc.bestAt = now;
  }
  await scoreDoc.save();

  return NextResponse.json({
    ok: true,
    bestScore: scoreDoc.bestScore,
    isNewBest: Boolean(improved),
  });
}
