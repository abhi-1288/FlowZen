import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { JoinRequest } from "@/models/JoinRequest";
import { Notification } from "@/models/Notification";
import {
  executeDepartmentDeletion,
  notifyDepartmentDelete,
} from "@/lib/department-delete";

export const maxDuration = 30;

/**
 * Runs daily. Executes department deletions whose 7-day grace period has
 * elapsed. `deletedAt` makes each request idempotent — a re-run or a retry
 * never deletes twice.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();

  const due = await JoinRequest.find({
    kind: "department-delete",
    status: "approved",
    "metadata.deleteAt": { $lte: new Date().toISOString() },
    "metadata.deletedAt": { $exists: false },
  }).lean();

  let executed = 0;
  const errors: string[] = [];

  for (const request of due) {
    try {
      const result = await executeDepartmentDeletion(request as any);
      const meta = { ...((request as any).metadata ?? {}), deletedAt: new Date().toISOString() };
      await JoinRequest.updateOne(
        { _id: (request as any)._id },
        { $set: { metadata: meta } },
      );

      const recipientIds = [
        String(meta.adminHeadId ?? ""),
        String(meta.hrHeadId ?? ""),
        String(meta.departmentHeadId ?? (request as any).requester),
        ...(Array.isArray(meta.memberIds) ? meta.memberIds.map(String) : []),
      ];
      await notifyDepartmentDelete(
        (request as any).company,
        recipientIds,
        "Department deleted",
        `The "${result.department}" department has been deleted after its 7-day notice. Members have been removed from it.`,
      );
      executed += 1;
    } catch (error) {
      errors.push(
        `${String((request as any)._id)}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return NextResponse.json({ ok: true, due: due.length, executed, errors });
}
