import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { STORE_CATEGORIES, STORE_CATEGORY_LABELS } from "@/lib/store";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  return NextResponse.json({
    categories: STORE_CATEGORIES.map((value) => ({
      value,
      label: STORE_CATEGORY_LABELS[value],
    })),
  });
}
