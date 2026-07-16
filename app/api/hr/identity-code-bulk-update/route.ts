import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import * as XLSX from "xlsx";

type PreviewRow = {
  row: number;
  userName: string;
  email: string;
  flowzenCode: string;
  originalCode: string;
  status: "ready" | "not-found" | "conflict" | "duplicate-email" | "code-taken" | "invalid-code";
  matchedUserId?: string;
  currentCode?: string;
};

function normalizeHeader(val: unknown): string {
  return String(val ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function findColumn(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => normalizeHeader(h) === normalizeHeader(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus");
  if (!user) return jsonError("User not found.", 404);

  const isAdmin = user.role === "admin" && String(user.company ?? "").length > 0;
  const isHr = user.role === "human-resource" && user.companyStatus === "approved" && Boolean(user.company);

  if (!isAdmin && !isHr) return jsonError("Only HR or admin can import identity codes.", 403);

  if (isAdmin && !isHr) {
    const hasHr = await User.findOne({
      company: user.company,
      role: "human-resource",
      companyStatus: "approved",
    }).select("_id");
    if (hasHr) return jsonError("HR exists. Only HR can import identity codes.", 403);
  }

  const companyId = user.company;

  const url = new URL(request.url);
  const confirm = url.searchParams.get("confirm") === "true";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid request body. Send a FormData with a file.", 400);
  }

  const file = formData.get("file") as File | null;
  if (!file) return jsonError("No file uploaded.", 400);

  const fileName = String(file.name ?? "").toLowerCase();
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv");
  if (!isExcel) return jsonError("Only .xlsx, .xls, or .csv files are supported.", 400);

  let rows: unknown[][];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return jsonError("Excel file is empty.", 400);
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  } catch {
    return jsonError("Failed to parse Excel file.", 400);
  }

  if (!rows || rows.length < 2) {
    return jsonError("Excel file must have a header row and at least one data row.", 400);
  }

  const headerRow = rows[0];
  const headers = headerRow.map((h) => String(h ?? ""));

  const userNameIdx = findColumn(headers, "UserName", "User Name", "Name", "Employee Name", "EmployeeName");
  const emailIdx = findColumn(headers, "Email", "EmailAddress", "Email Address", "E-mail");
  const flowzenCodeIdx = findColumn(headers, "FlowzenCode", "Flowzen Code", "CurrentCode", "Current Code", "Existing Code", "ExistingCode", "FlowzenID", "Flowzen ID");
  const originalCodeIdx = findColumn(headers, "OriginalCode", "Original Code", "NewCode", "New Code", "IDCode", "ID Code", "Identity Code", "IdentityCode", "Employee Code", "EmployeeCode");

  if (emailIdx === -1) return jsonError("Column 'Email' not found. Headers: " + headers.join(", "), 400);
  if (originalCodeIdx === -1) return jsonError("Column 'Original Code' not found. Headers: " + headers.join(", "), 400);

  const dataRows = rows.slice(1).filter((row) => {
    return row && row.some((cell) => cell != null && String(cell).trim() !== "");
  });

  if (dataRows.length === 0) {
    return jsonError("No data rows found in the Excel file.", 400);
  }

  const allCompanyUsers = await User.find({
    company: companyId,
    companyStatus: "approved",
  }).select("name email companyIdentityCode");

  const emailMap = new Map<string, typeof allCompanyUsers[0]>();
  for (const u of allCompanyUsers) {
    const email = String(u.email ?? "").trim().toLowerCase();
    if (email) emailMap.set(email, u);
  }

  const takenCodes = new Set<string>();
  for (const u of allCompanyUsers) {
    const code = String(u.companyIdentityCode ?? "").trim();
    if (code) takenCodes.add(code);
  }

  const preview: PreviewRow[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    const userName = userNameIdx !== -1 ? String(row[userNameIdx] ?? "").trim() : "";
    const email = emailIdx !== -1 ? String(row[emailIdx] ?? "").trim().toLowerCase() : "";
    const flowzenCode = flowzenCodeIdx !== -1 ? String(row[flowzenCodeIdx] ?? "").trim() : "";
    const originalCode = originalCodeIdx !== -1 ? String(row[originalCodeIdx] ?? "").trim() : "";

    if (!email && !originalCode) continue;

    const entry: PreviewRow = {
      row: rowNum,
      userName,
      email,
      flowzenCode,
      originalCode,
      status: "ready",
    };

    if (!email) {
      entry.status = "not-found";
      preview.push(entry);
      continue;
    }

    if (seenEmails.has(email)) {
      entry.status = "duplicate-email";
      preview.push(entry);
      continue;
    }
    seenEmails.add(email);

    const matchedUser = emailMap.get(email);
    if (!matchedUser) {
      entry.status = "not-found";
      preview.push(entry);
      continue;
    }

    entry.matchedUserId = String(matchedUser._id);
    entry.currentCode = String(matchedUser.companyIdentityCode ?? "");

    if (flowzenCode && entry.currentCode && flowzenCode !== entry.currentCode) {
      entry.status = "conflict";
      preview.push(entry);
      continue;
    }

    if (!originalCode) {
      entry.status = "invalid-code";
      preview.push(entry);
      continue;
    }

    if (takenCodes.has(originalCode) && originalCode !== entry.currentCode) {
      entry.status = "code-taken";
      preview.push(entry);
      continue;
    }

    preview.push(entry);
  }

  if (!confirm) {
    const readyCount = preview.filter((r) => r.status === "ready").length;
    const errorCount = preview.length - readyCount;
    return NextResponse.json({
      preview,
      summary: { total: preview.length, ready: readyCount, errors: errorCount },
    });
  }

  const readyRows = preview.filter((r) => r.status === "ready");
  if (readyRows.length === 0) {
    return NextResponse.json({ applied: 0, errors: preview.length, details: preview });
  }

  let applied = 0;
  const results: PreviewRow[] = [];

  for (const row of readyRows) {
    try {
      await User.updateOne(
        { _id: row.matchedUserId, company: companyId },
        { $set: { companyIdentityCode: row.originalCode } },
      );
      takenCodes.delete(row.currentCode ?? "");
      takenCodes.add(row.originalCode);
      results.push({ ...row, status: "ready" });
      applied++;
    } catch {
      results.push({ ...row, status: "code-taken" });
    }
  }

  const errorRows = preview.filter((r) => r.status !== "ready");

  return NextResponse.json({
    applied,
    errors: errorRows.length,
    details: [...results, ...errorRows],
  });
}
