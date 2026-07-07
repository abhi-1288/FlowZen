import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { saveDocument, deleteDocument } from "@/lib/storage";
import { parseResume } from "@/lib/resume-parser";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
    const user = await User.findById(userId).select("company companyStatus documents");
    if (!user || !user.company || user.companyStatus !== "approved")
      return jsonError("Approved company access is required.", 403);

    const company = await Company.findById(user.company).select("requiredDocuments");
    const categories = (company?.requiredDocuments ?? []).map((c: any) => ({
      name: String(c.name),
      mandatory: Boolean(c.mandatory),
      fields: Array.isArray(c.fields) ? c.fields.map((f: any) => ({ label: String(f.label), type: String(f.type) })) : [],
    }));

    const uploaded = (user.documents ?? []).map((d: any) => ({
      category: String(d.category),
      fileName: String(d.fileName),
      fileType: String(d.fileType),
      fileSize: Number(d.fileSize),
      fileUrl: String(d.fileUrl),
      uploadedAt: d.uploadedAt,
      fieldValues: Array.isArray(d.fieldValues) ? d.fieldValues.map((fv: any) => ({ label: String(fv.label), value: String(fv.value) })) : [],
    }));

    return NextResponse.json({ categories, documents: uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const category = String(form.get("category") ?? "").trim();
    let fieldValues: { label: string; value: string }[] = [];
    try {
      const raw = form.get("fieldValues");
      if (raw) fieldValues = JSON.parse(String(raw));
    } catch { /* ignore */ }

    if (!file || !category) return jsonError("file and category are required.", 400);
    if (file.size === 0) return jsonError("File is empty.", 400);
    if (file.size > 20 * 1024 * 1024) return jsonError("File exceeds 20 MB limit.", 400);

    await connectDb();
    const user = await User.findById(userId).select("company companyStatus documents");
    if (!user || !user.company || user.companyStatus !== "approved")
      return jsonError("Approved company access is required.", 403);

    const company = await Company.findById(user.company).select("requiredDocuments");
    const validCategory = (company?.requiredDocuments ?? []).find(
      (c: any) => String(c.name).trim() === category,
    );
    if (!validCategory) return jsonError(`Category "${category}" is not valid.`, 400);

    const acceptedFileTypes = Array.isArray((validCategory as any).acceptedFileTypes)
      ? (validCategory as any).acceptedFileTypes.map((t: string) => String(t).toLowerCase())
      : [];
    if (acceptedFileTypes.length > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!acceptedFileTypes.includes(ext))
        return jsonError(`File type .${ext} not accepted. Allowed: ${acceptedFileTypes.map((t: string) => `.${t}`).join(", ")}`, 400);
    }

    const existing = (user.documents ?? []).find(
      (d: any) => String(d.category) === category,
    );
    if (existing) return jsonError("Delete the existing document first before uploading a new one.", 400);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${userId}_${category}_${Date.now()}.${ext}`;

    const { url, fileName, fileType, fileSize } = await saveDocument(file, key);

    // Try to extract blood group from PDF or field values
    let bloodGroupExtracted = "";
    if (ext === "pdf") {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parseResume(buffer);
        bloodGroupExtracted = parsed.bloodGroup;
      } catch { /* silent */ }
    }
    if (!bloodGroupExtracted) {
      for (const fv of fieldValues) {
        const val = fv.value.trim().toUpperCase();
        if (/^(A|B|O|AB)[+-]$/.test(val)) {
          bloodGroupExtracted = val;
          break;
        }
      }
    }
    if (bloodGroupExtracted) {
      user.bloodGroup = bloodGroupExtracted;
    }

    user.documents.push({ category, fileName, fileType, fileSize, fileUrl: url, fieldValues });
    await user.save();

    return NextResponse.json({ ok: true, url, fileName, fileType, fileSize, category, fieldValues });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    const url = new URL(request.url);
    const category = String(url.searchParams.get("category") ?? "").trim();
    if (!category) return jsonError("category query param is required.", 400);

    await connectDb();
    const user = await User.findById(userId).select("company companyStatus documents");
    if (!user || !user.company || user.companyStatus !== "approved")
      return jsonError("Approved company access is required.", 403);

    const idx = (user.documents ?? []).findIndex(
      (d: any) => String(d.category) === category,
    );
    if (idx === -1) return jsonError("No document found for this category.", 404);

    const doc = user.documents[idx];
    const urlPath = String(doc.fileUrl ?? "");
    const key = urlPath.split("/").pop() ?? "";

    user.documents.splice(idx, 1);
    await user.save();

    if (key) {
      await deleteDocument(key).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
