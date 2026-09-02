import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { GameScore } from "@/models/GameScore";
import { User } from "@/models/User";
import { GAMES, GAME_IDS } from "@/lib/games-catalog";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("company companyStatus role name");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || String(user.companyStatus) !== "approved") {
    return jsonError("You must be an approved company member to view games.", 403);
  }
  const companyId = String(user.company);

  const scores = await GameScore.find({ company: companyId })
    .select("user game bestScore lastScore plays bestAt")
    .lean();

  const userIds = Array.from(new Set(scores.map((s) => String(s.user ?? "")).filter(Boolean)));
  const members = await User.find({ _id: { $in: userIds } })
    .select("name avatarUrl role")
    .lean();
  const memberById = new Map(
    members.map((m) => [
      String((m as any)._id),
      {
        id: String((m as any)._id),
        name: String((m as any).name ?? "Unknown"),
        avatarUrl: String((m as any).avatarUrl ?? ""),
        role: String((m as any).role ?? ""),
      },
    ]),
  );

  const allMembers = await User.find({ company: companyId, companyStatus: "approved" })
    .select("name avatarUrl role")
    .sort({ name: 1 })
    .lean();

  const leaderboardsByGame: Record<string, any[]> = {};
  for (const gameId of GAME_IDS) {
    const rows = scores
      .filter((s) => String(s.game) === gameId)
      .map((s) => ({
        user: memberById.get(String(s.user)) ?? { id: String(s.user), name: "Unknown", avatarUrl: "", role: "" },
        game: gameId,
        bestScore: Number(s.bestScore ?? 0),
        plays: Number(s.plays ?? 0),
        bestAt: s.bestAt ?? null,
      }))
      .filter((r) => r.bestScore > 0)
      .sort((a, b) =>
        GAMES.find((g) => g.id === gameId)?.lowerIsBetter
          ? a.bestScore - b.bestScore
          : b.bestScore - a.bestScore,
      );
    leaderboardsByGame[gameId] = rows;
  }

  const totalsByUser = new Map<string, number>();
  for (const s of scores) {
    const uid = String(s.user ?? "");
    const cur = totalsByUser.get(uid) ?? 0;
    totalsByUser.set(uid, cur + Number(s.bestScore ?? 0));
  }
  const overall = Array.from(totalsByUser.entries())
    .map(([uid, total]) => ({
      user: memberById.get(uid) ?? { id: uid, name: "Unknown", avatarUrl: "", role: "" },
      total,
      games: scores.filter((s) => String(s.user) === uid && Number(s.bestScore) > 0).length,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const rankOf = (list: any[], targetId: string) => {
    const idx = list.findIndex((r) => String(r.user.id) === targetId);
    return idx === -1 ? null : idx + 1;
  };

  const myScores = scores
    .filter((s) => String(s.user) === userId)
    .map((s) => ({
      game: String(s.game),
      bestScore: Number(s.bestScore ?? 0),
      plays: Number(s.plays ?? 0),
      bestAt: s.bestAt ?? null,
    }));

  const myTotal = totalsByUser.get(userId) ?? 0;

  return NextResponse.json({
    catalog: GAMES.map((g) => ({ ...g })),
    myScores,
    myOverall: myTotal,
    myRankOverall: rankOf(overall, userId),
    overall,
    perGame: leaderboardsByGame,
    myPerGameRank: Object.fromEntries(
      GAME_IDS.map((gid) => [gid, rankOf(leaderboardsByGame[gid] ?? [], userId)]),
    ),
    members: allMembers
      .filter((m) => String((m as any)._id) !== userId)
      .map((m) => ({
        id: String((m as any)._id),
        name: String((m as any).name ?? "Unknown"),
        avatarUrl: String((m as any).avatarUrl ?? ""),
        role: String((m as any).role ?? ""),
      })),
  });
}
