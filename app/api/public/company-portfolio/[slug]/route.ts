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

  const company = (await Company.findOne({ slug: normalized, status: "active" })
    .select("name icon primaryColor slug address addresses website supportEmail startDate requiredDocuments multiOffice tagline about mission")
    .lean()) as Record<string, unknown> | null;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  return NextResponse.json({
    name: company.name || null,
    icon: company.icon || null,
    primaryColor: company.primaryColor || "#2563eb",
    slug: company.slug || null,
    tagline: company.tagline || null,
    about: company.about || null,
    mission: company.mission || null,
    address: company.address || null,
    addresses: Array.isArray(company.addresses) ? company.addresses : [],
    multiOffice: Boolean(company.multiOffice),
    website: company.website || null,
    supportEmail: company.supportEmail || null,
    startDate: company.startDate || null,
    requiredDocuments: Array.isArray(company.requiredDocuments) ? company.requiredDocuments : [],
  });
}
