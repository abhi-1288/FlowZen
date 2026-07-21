import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { EntryLog } from "@/models/EntryLog";
import { VisitorPass } from "@/models/VisitorPass";
import * as XLSX from "xlsx";

function startOfDay(value: string): Date | null {
  if (!value) return null;
  const parts = value.split("T")[0].split("-");
  if (parts.length < 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day, 0, 0, 0, 0);
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function safeFilenamePart(value: unknown) {
  const text = String(value ?? "company").trim();
  return (
    text
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "company"
  );
}

function formatTime(date: Date | null): string {
  if (!date) return "--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = (await import("@/lib/api")).databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (actor.role !== "security" || !actor.isSeniorSecurity) {
    return jsonError("Only senior security can export logs.", 403);
  }

  const url = new URL(request.url);
  const from = startOfDay(url.searchParams.get("from") ?? "");
  const to = startOfDay(url.searchParams.get("to") ?? "");
  if (!from || !to) return jsonError("Start and end dates are required.");
  if (from.getTime() > to.getTime()) return jsonError("Start date must be before end date.");

  const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

  const company = await Company.findById(actor.company).select("name");
  const companyName = String((company as any)?.name ?? "company");

  // ── Employees ──
  const members = await User.find({
    company: actor.company,
    companyStatus: "approved",
  }).select("name companyIdentityCode");

  const memberMap = new Map<string, { name: string; identityCode: string }>();
  for (const m of members as any[]) {
    memberMap.set(String(m._id), {
      name: String(m.name ?? ""),
      identityCode: String(m.companyIdentityCode ?? ""),
    });
  }

  // ── Fetch ALL entry logs (employees + visitors) ──
  const logs = await EntryLog.find({
    company: actor.company,
    timestamp: { $gte: from, $lte: toEnd },
  })
    .select("user visitorPass type timestamp")
    .sort({ timestamp: 1 })
    .lean();

  // ── Visitor pass names ──
  const visitorPassIds = [...new Set(
    (logs as any[])
      .filter((l) => l.visitorPass)
      .map((l) => String(l.visitorPass)),
  )];

  const visitorPassMap = new Map<string, string>();
  if (visitorPassIds.length > 0) {
    const passes = await VisitorPass.find({ _id: { $in: visitorPassIds } })
      .select("visitorName visitorCompany")
      .lean();
    for (const p of passes as any[]) {
      const company = String(p.visitorCompany ?? "").trim();
      const name = String(p.visitorName ?? "Visitor");
      visitorPassMap.set(String(p._id), company ? `${name} (${company})` : name);
    }
  }

  // ── Build map: personKey -> date -> { in, out } ──
  // personKey = "emp:<userId>" or "vis:<visitorPassId>"
  const personDayMap = new Map<string, Map<string, { in: Date | null; out: Date | null }>>();
  const personMeta = new Map<string, { name: string; id: string }>();

  for (const log of logs as any[]) {
    const ts = new Date(log.timestamp);
    const day = isoDay(ts);
    let personKey: string;
    let meta: { name: string; id: string };

    if (log.user) {
      const uid = String(log.user);
      personKey = `emp:${uid}`;
      if (!personMeta.has(personKey)) {
        const info = memberMap.get(uid);
        personMeta.set(personKey, {
          name: info?.name ?? "",
          id: info?.identityCode || uid,
        });
      }
    } else if (log.visitorPass) {
      const vpid = String(log.visitorPass);
      personKey = `vis:${vpid}`;
      if (!personMeta.has(personKey)) {
        personMeta.set(personKey, {
          name: visitorPassMap.get(vpid) ?? "Visitor",
          id: `VISITOR-${vpid.slice(-6).toUpperCase()}`,
        });
      }
    } else {
      continue;
    }

    if (!personDayMap.has(personKey)) personDayMap.set(personKey, new Map());
    const dayMap = personDayMap.get(personKey)!;
    if (!dayMap.has(day)) dayMap.set(day, { in: null, out: null });

    const entry = dayMap.get(day)!;
    if (log.type === "entry" && !entry.in) {
      entry.in = ts;
    } else if (log.type === "exit" && !entry.out) {
      entry.out = ts;
    }
  }

  // ── Build date columns ──
  const dayCount = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  const dates: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    dates.push(isoDay(d));
  }

  // Headers: Name, ID, then for each date: "DD/MM In", "DD/MM Out"
  const headers = ["Name", "ID"];
  for (const dateStr of dates) {
    const parts = dateStr.split("-");
    const label = `${parts[2]}/${parts[1]}`;
    headers.push(`${label} In`, `${label} Out`);
  }

  // Build rows — anyone with at least one log
  const rows: (string | number)[][] = [];
  for (const [personKey, dayMap] of personDayMap) {
    const meta = personMeta.get(personKey);
    if (!meta) continue;

    const row: (string | number)[] = [meta.name, meta.id];
    for (const dateStr of dates) {
      const entry = dayMap.get(dateStr);
      row.push(formatTime(entry?.in ?? null));
      row.push(formatTime(entry?.out ?? null));
    }
    rows.push(row);
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = [
    { wch: 25 },  // Name
    { wch: 22 },  // ID
    ...dates.flatMap(() => [{ wch: 10 }, { wch: 10 }]),
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Entry-Exit Logs");

  const fromStr = isoDay(from);
  const toStr = isoDay(to);
  const safeCompany = safeFilenamePart(companyName);
  const filename = `${safeCompany}-entry-exit-log-${fromStr}-to-${toStr}.xlsx`;

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
