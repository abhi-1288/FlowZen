import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const actorId = await requireUserId();
  if (!actorId) return jsonError("Unauthorized", 401);

  const { id: memberId } = await params;

  try {
    await connectDb();
    const actor = await User.findById(actorId).select("role company companyStatus");
    if (!actor || !actor.company || actor.companyStatus !== "approved")
      return jsonError("Approved company access is required.", 403);
    if (!["human-resource", "finance", "admin"].includes(String(actor.role ?? "")))
      return jsonError("Only HR, finance, or admin can view member documents.", 403);

    const member = await User.findById(memberId).select("documents name email role company");
    if (!member) return jsonError("Member not found.", 404);
    if (String(member.company) !== String(actor.company))
      return jsonError("Member is not in your company.", 403);

    const company = await Company.findById(actor.company).select("requiredDocuments");
    const categories = (company?.requiredDocuments ?? []).map((c: any) => ({
      name: String(c.name),
      mandatory: Boolean(c.mandatory),
      fields: Array.isArray(c.fields) ? c.fields.map((f: any) => ({ label: String(f.label), type: String(f.type) })) : [],
    }));

    const documents = (member.documents ?? []).map((d: any) => ({
      category: String(d.category),
      fileName: String(d.fileName),
      fileType: String(d.fileType),
      fileSize: Number(d.fileSize),
      fileUrl: String(d.fileUrl),
      uploadedAt: d.uploadedAt,
      fieldValues: Array.isArray(d.fieldValues) ? d.fieldValues.map((fv: any) => ({ label: String(fv.label), value: String(fv.value) })) : [],
    }));

    return NextResponse.json({
      member: { name: member.name, email: member.email, role: member.role },
      categories,
      documents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
