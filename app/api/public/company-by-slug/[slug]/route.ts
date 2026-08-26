import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Company } from "@/models/Company";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized || normalized.length > 40) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  try {
    await connectDb();
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const company = (await Company.findOne({ slug: normalized })
    .select("name icon primaryColor slug status")
    .lean()) as { name?: string; icon?: string; primaryColor?: string; slug?: string; status?: string } | null;

  if (!company || company.status !== "active") {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  return NextResponse.json({
    name: company.name,
    icon: company.icon || null,
    primaryColor: company.primaryColor || "#2563eb",
    slug: company.slug,
  });
}
