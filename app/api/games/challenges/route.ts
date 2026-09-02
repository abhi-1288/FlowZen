import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { GameChallenge } from "@/models/GameChallenge";
import { User } from "@/models/User";
import { GAMES } from "@/lib/games-catalog";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const user = await User.findById(userId).select("company companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || String(user.companyStatus) !== "approved") {
    return jsonError("You must be an approved company member.", 403);
  }

  const [incoming, sent] = await Promise.all([
    GameChallenge.find({ to: userId, company: user.company })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    GameChallenge.find({ from: userId, company: user.company })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  const ids = Array.from(
    new Set(
      [
        ...incoming.map((c) => String(c.from)),
        ...sent.map((c) => String(c.to)),
        ...incoming.map((c) => String(c.to)),
        ...sent.map((c) => String(c.from)),
      ].filter(Boolean),
    ),
  );
  const members = await User.find({ _id: { $in: ids } })
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
  const related = (c: any) => {
    const meta = GAMES.find((g) => g.id === String(c.game));
    return {
      id: String(c._id),
      game: String(c.game),
      gameName: meta?.name ?? String(c.game),
      score: Number(c.score ?? 0),
      message: String(c.message ?? ""),
      status: String(c.status ?? "pending"),
      read: Boolean(c.read),
      createdAt: c.createdAt,
      from: memberById.get(String(c.from)) ?? { id: String(c.from), name: "Unknown", avatarUrl: "", role: "" },
      to: memberById.get(String(c.to)) ?? { id: String(c.to), name: "Unknown", avatarUrl: "", role: "" },
    };
  };

  return NextResponse.json({
    incoming: incoming.map(related),
    sent: sent.map(related),
  });
}
