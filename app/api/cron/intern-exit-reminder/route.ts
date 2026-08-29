import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { JoinRequest } from "@/models/JoinRequest";
import { Team } from "@/models/Team";
import { emitToUser } from "@/lib/socket-emit";
import { listApprovedAdminUserIds } from "@/lib/join-approvers";

function fmt(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function alreadySent(userId: string, title: string, body: string) {
  const existing = await Notification.findOne({ user: userId, title, body });
  return Boolean(existing);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // 2-day window centered at 7 days out, to survive a missed run
  const winStart = new Date(todayStart);
  winStart.setDate(winStart.getDate() + 6);
  const winEnd = new Date(todayEnd);
  winEnd.setDate(winEnd.getDate() + 8);

  const processed = new Set<string>();
  let created = 0;

  async function pushNotify(
    userId: string,
    company: unknown,
    title: string,
    body: string,
    link = "/profile",
  ) {
    if (await alreadySent(userId, title, body)) return;
    await Notification.create({
      user: userId,
      company,
      type: "deadline",
      title,
      body,
      link,
    });
    emitToUser(userId, "notification:new", {});
    created += 1;
  }

  async function notifyForExit(member: any, exitDate: Date | string, typeLabel: string) {
    const memberId = String(member._id ?? member.requester?._id);
    if (processed.has(memberId)) return;
    processed.add(memberId);

    const company = member.company;
    const region = String(member.regionLabel ?? "");
    const exitStr = fmt(exitDate);
    const name = String(member.name ?? "A member");

    // 1. The member themselves
    await pushNotify(
      memberId,
      company,
      "Employment Ending Soon",
      `Your ${typeLabel} period ends on ${exitStr}. Please prepare for your exit.`,
    );

    // 2. Region HR (fallback to all company HR when no region match)
    let hrs = region
      ? await User.find({
          company,
          role: "human-resource",
          companyStatus: "approved",
          regionLabel: region,
        }).select("_id")
      : [];
    if (!hrs.length) {
      hrs = await User.find({
        company,
        role: "human-resource",
        companyStatus: "approved",
      }).select("_id");
    }
    for (const hr of hrs) {
      await pushNotify(
        String(hr._id),
        company,
        "Intern Exit Reminder",
        `${name}'s ${typeLabel} ends on ${exitStr}${region ? ` (Region: ${region})` : ""}.`,
      );
    }

    // 3. Admins
    const adminIds = await listApprovedAdminUserIds(String(company));
    for (const adminId of adminIds) {
      await pushNotify(
        adminId,
        company,
        "Intern Exit Reminder",
        `${name}'s ${typeLabel} ends on ${exitStr}.`,
      );
    }

    // 4. Team managers only
    const teamIds: string[] = [];
    if (member.team) teamIds.push(String(member.team));
    if (Array.isArray(member.activeTeams)) {
      for (const t of member.activeTeams) teamIds.push(String(t));
    }
    if (teamIds.length) {
      const teams = await Team.find({ _id: { $in: teamIds } }).select("manager");
      const managerIds = new Set<string>();
      for (const t of teams) {
        if (t.manager) managerIds.add(String(t.manager));
      }
      for (const mgrId of managerIds) {
        await pushNotify(
          mgrId,
          company,
          "Team Member Exit",
          `${name}'s ${typeLabel} ends on ${exitStr}.`,
        );
      }
    }
  }

  // Source A: converted members with employmentEndDate set
  const members = await User.find({
    employmentEndDate: { $gte: winStart, $lte: winEnd },
    employmentType: { $regex: /intern|contract|part-time|permanent/i },
  }).select("_id name role company regionLabel employmentType employmentEndDate team activeTeams");

  for (const m of members) {
    const typeLabel = String(m.employmentType || "employment");
    await notifyForExit(m, m.employmentEndDate, typeLabel);
  }

  // Source B: approved internship letters whose internshipEnd falls in window,
  // for users whose employmentEndDate is empty (backfill)
  const letterRequests = await JoinRequest.find({
    kind: "document-letter",
    status: "approved",
    "metadata.letterType": "internship",
    "metadata.internshipEnd": { $gte: winStart, $lte: winEnd },
  }).populate("requester", "_id name role company regionLabel employmentType team activeTeams");

  for (const req of letterRequests) {
    const requester = req.requester as any;
    if (!requester) continue;
    if (processed.has(String(requester._id))) continue;
    const exit = (req.metadata as any)?.internshipEnd;
    if (!exit) continue;
    await notifyForExit(requester, exit, "internship");
  }

  return NextResponse.json({ ok: true, created });
}
