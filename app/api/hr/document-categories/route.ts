import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
    const user = await User.findById(userId).select("role company companyStatus");
    if (!user || !user.company || user.companyStatus !== "approved")
      return jsonError("Approved company access is required.", 403);
    if (user.role !== "human-resource")
      return jsonError("Only HR can manage document categories.", 403);

    const company = await Company.findById(user.company).select("requiredDocuments");
    if (!company) return jsonError("Company not found.", 404);

    return NextResponse.json({ categories: company.requiredDocuments ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
    const user = await User.findById(userId).select("role company companyStatus");
    if (!user || !user.company || user.companyStatus !== "approved")
      return jsonError("Approved company access is required.", 403);
    if (user.role !== "human-resource")
      return jsonError("Only HR can manage document categories.", 403);

    const body = await request.json().catch(() => ({}));
    const categories = (body as any).categories;
    if (!Array.isArray(categories))
      return jsonError("categories must be an array.", 400);

    for (const cat of categories) {
      if (!cat.name || typeof cat.name !== "string" || !cat.name.trim())
        return jsonError("Each category must have a non-empty name.", 400);
    }

    const sanitised = categories.map((cat: any) => {
      const fields = Array.isArray(cat.fields)
        ? cat.fields.map((f: any) => ({
            label: String(f.label ?? "").trim(),
            type: String(f.type ?? "text").trim(),
          })).filter((f: any) => f.label.length > 0)
        : [];
      const acceptedFileTypes = Array.isArray(cat.acceptedFileTypes)
        ? cat.acceptedFileTypes.map((t: any) => String(t).trim().toLowerCase()).filter((t: string) => t.length > 0)
        : [];
      return {
        name: String(cat.name).trim(),
        mandatory: Boolean(cat.mandatory),
        acceptedFileTypes,
        fields,
      };
    });

    const company = await Company.findById(user.company);
    if (!company) return jsonError("Company not found.", 404);

    company.requiredDocuments = sanitised;
    await company.save();

    return NextResponse.json({ categories: company.requiredDocuments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
