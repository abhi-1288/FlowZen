import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, requireUnlockedUserId } from "@/lib/api";
import { fulfillGreenPinResetRequest } from "@/lib/session-lock";
import { recordAudit } from "@/lib/audit";
import { isPinLength } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await requireUnlockedUserId();
  if (userId instanceof NextResponse) return userId;
  if (typeof userId !== "string") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const length = isPinLength(body.length) ? Number(body.length) : null;
  const providedPin = body.pin == null ? null : String(body.pin);
  const generate = Boolean(body.generate) || providedPin == null;

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  let result: Awaited<ReturnType<typeof fulfillGreenPinResetRequest>>;
  try {
    result = await fulfillGreenPinResetRequest(id, userId, {
      pin: providedPin,
      length,
      generate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset this Green PIN.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await recordAudit({
    action: "auth.pin.reset.approved",
    actionLabel: "Regional HR approved a Green PIN reset",
    actor: { id: userId },
    target: { id: result.requestId },
    result: "success",
    metadata: {
      requestId: result.requestId,
      length: result.length,
      emailSent: result.emailSent,
    },
  });

  return NextResponse.json(result);
}
