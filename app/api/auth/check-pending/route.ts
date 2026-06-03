import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) return jsonError("Email is required.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findOne({ email, emailVerified: false, authProvider: "credentials" }).select("_id");
  if (!user) return NextResponse.json({ pending: false });

  return NextResponse.json({ pending: true, email });
}
