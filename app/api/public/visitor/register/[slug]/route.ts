import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError } from "@/lib/api";
import { VisitorEvent } from "@/models/VisitorEvent";
import { VisitorPass } from "@/models/VisitorPass";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { saveDocument } from "@/lib/storage";

type EventDoc = Record<string, unknown>;
type UserDoc = Record<string, unknown>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const { slug } = await params;

  const event = await VisitorEvent.findOne({ slug }).lean() as EventDoc | null;
  if (!event) return jsonError("Visit not found.", 404);

  const form = await request.formData();

  const visitorName = String(form.get("visitorName") ?? "").trim();
  const visitorEmail = String(form.get("visitorEmail") ?? "").trim().toLowerCase();
  const visitorPhone = String(form.get("visitorPhone") ?? "").trim();
  const visitorCompany = String(form.get("visitorCompany") ?? "").trim();
  const purpose = String(form.get("purpose") ?? "").trim();
  const region = String(form.get("region") ?? "").trim();
  const visitAddress = String(form.get("visitAddress") ?? "").trim();
  const idDocument = form.get("idDocument") as File | null;

  if (!visitorName) return jsonError("Name is required.");
  if (!visitorEmail) return jsonError("Email is required.");

  let idDocumentUrl = "";
  if (idDocument && idDocument.size > 0) {
    if (idDocument.size > 10 * 1024 * 1024) return jsonError("Document exceeds 10 MB limit.", 400);
    const ext = idDocument.name.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `visitor_${slug}_${Date.now()}.${ext}`;
    const result = await saveDocument(idDocument, key, "visitor-documents");
    idDocumentUrl = result.url;
  }

  const pass = await VisitorPass.create({
    event: event._id,
    company: event.company,
    visitorName,
    visitorEmail,
    visitorPhone,
    visitorCompany,
    purpose,
    idDocumentUrl,
    hostName: String(event.hostName ?? ""),
    region,
    visitAddress,
    identityCode: null,
    status: "pending",
  });

  // Notify all HR + admin users in the company
  const hrUsers = await User.find({
    company: event.company,
    companyStatus: "approved",
    role: { $in: ["human-resource", "admin"] },
  }).select("_id").lean() as UserDoc[];

  const companyName = String(event.visitorCompany ?? "your company");
  const notifications = hrUsers.map((u) => ({
    user: u._id,
    company: event.company,
    type: "approval" as const,
    title: "Visitor Registration",
    message: `${visitorName} has registered for a visit to ${companyName}.`,
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    hrUsers.forEach((u) => emitNotification(String(u._id)));
  }

  return NextResponse.json({ success: true, passId: String(pass._id) });
}
