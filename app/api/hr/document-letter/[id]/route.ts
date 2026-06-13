import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

export async function PATCH() {
  return jsonError("Internship content editing is no longer supported.", 400);
}
