import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  actorHasGlobalBoardAccess,
  getAccessibleTodo,
  getContinuityActor,
} from "@/lib/continuity-access";
import { notifyUsers } from "@/lib/compaction-service";
import { BoardTodo } from "@/models/BoardTodo";
import { TaskHandover } from "@/models/TaskHandover";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

function idString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const record = value as { _id?: unknown; id?: unknown };
  return String(record._id ?? record.id ?? "");
}

function restoredStatus(progress: number): "in_progress" | "not_started" {
  return progress > 0 ? "in_progress" : "not_started";
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid handover id.");

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const handover = await TaskHandover.findById(id)
    .populate("fromEmployee", "name email avatarUrl")
    .populate("toEmployee", "name email avatarUrl")
    .populate("requestedBy", "name email")
    .populate("todo", "title status assigneeId originalOwnerId progress currentWorkingDate");
  if (!handover) return jsonError("Handover not found.", 404);

  const isParticipant = [handover.fromEmployee, handover.toEmployee, handover.requestedBy]
    .map((value) => (value && typeof value === "object" ? idString(value) : idString(value)))
    .includes(userId);
  if (!isParticipant && !actorHasGlobalBoardAccess(actor)) {
    const access = await getAccessibleTodo(idString(handover.todo), actor);
    if (!access) return jsonError("Handover not found.", 404);
  }
  if (
    actor.company &&
    handover.company &&
    String(handover.company) !== actor.company &&
    !actorHasGlobalBoardAccess(actor)
  ) {
    return jsonError("Handover not found.", 404);
  }

  return NextResponse.json({ handover: serializeDoc(handover) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid handover id.");
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();
  if (!["accept", "decline", "cancel"].includes(action)) {
    return jsonError("Action must be accept, decline or cancel.");
  }

  await connectDb();
  const actor = await getContinuityActor(userId);
  if (!actor) return jsonError("User not found.", 404);
  const handover = await TaskHandover.findById(id);
  if (!handover) return jsonError("Handover not found.", 404);

  if (
    actor.company &&
    handover.company &&
    String(handover.company) !== actor.company &&
    !actorHasGlobalBoardAccess(actor)
  ) {
    return jsonError("Handover not found.", 404);
  }

  const fromId = idString(handover.fromEmployee);
  const toId = idString(handover.toEmployee);
  const requestedById = idString(handover.requestedBy);
  const isRecipient = toId === userId;
  const canCancel =
    fromId === userId ||
    requestedById === userId ||
    actorHasGlobalBoardAccess(actor);

  const todoAccess = await getAccessibleTodo(String(handover.todo), actor);
  if (!todoAccess) return jsonError("Todo not found.", 404);
  const todo = todoAccess.todo;

  if (action === "accept" && !isRecipient) {
    return jsonError("Only the recipient can accept this handover.", 403);
  }
  if (action === "decline" && !isRecipient) {
    return jsonError("Only the recipient can decline this handover.", 403);
  }
  if (action === "cancel" && !canCancel) {
    return jsonError("You cannot cancel this handover.", 403);
  }

  // Idempotent resolution: repeated clicks return the stored outcome.
  if (String(handover.status) !== "pending") {
    if (
      (action === "accept" && handover.status === "accepted") ||
      (action === "decline" && handover.status === "declined") ||
      (action === "cancel" && handover.status === "cancelled")
    ) {
      return NextResponse.json({ handover: serializeDoc(handover), changed: false });
    }
    return jsonError("This handover has already been resolved.", 409);
  }

  const now = new Date();
  const progress = Number(todo.progress ?? 0);

  if (action === "accept") {
    const recipient = await User.findOne({
      _id: toId,
      ...(handover.company ? { company: handover.company } : {}),
      companyStatus: "approved",
    }).select("name email");
    if (!recipient) {
      return jsonError("The recipient is no longer an approved member of this company.", 409);
    }

    handover.status = "accepted";
    handover.acceptedAt = now;
    handover.resolvedBy = userId;
    await handover.save();

    await BoardTodo.updateOne(
      { _id: handover.todo },
      {
        $set: {
          assigneeId: handover.toEmployee,
          status: restoredStatus(progress),
          updatedBy: userId,
        },
        $push: {
          delegationHistory: {
            from: handover.fromEmployee ?? null,
            to: handover.toEmployee,
            status: "accepted",
            reason: "Recipient accepted the handover",
            at: now,
          },
        },
      },
    );

    // A second pending request for the same todo is now moot.
    await TaskHandover.updateMany(
      { todo: handover.todo, _id: { $ne: handover._id }, status: "pending" },
      {
        $set: {
          status: "cancelled",
          cancelledAt: now,
          resolvedBy: userId,
          declineReason: "Another delegation for this todo was accepted",
        },
      },
    );

    const notifyIds = Array.from(new Set([fromId, requestedById, idString(todo.originalOwnerId)].filter(Boolean)));
    await notifyUsers(notifyIds.filter((value) => value !== userId), {
      title: "Handover accepted",
      message: `${String(recipient.name ?? "The recipient")} accepted "${String(todo.title ?? "a todo")}".`,
      link: "/boards?tab=delegated-work",
      type: "info",
      company: handover.company ? String(handover.company) : null,
    });
  } else if (action === "decline") {
    handover.status = "declined";
    handover.declinedAt = now;
    handover.declineReason = String(body.reason ?? "").slice(0, 2000);
    handover.resolvedBy = userId;
    await handover.save();

    await BoardTodo.updateOne(
      { _id: handover.todo },
      {
        $set: { status: restoredStatus(progress), updatedBy: userId },
        $push: {
          delegationHistory: {
            from: handover.fromEmployee ?? null,
            to: handover.toEmployee,
            status: "declined",
            reason: handover.declineReason,
            at: now,
          },
        },
      },
    );

    await notifyUsers(
      Array.from(new Set([fromId, requestedById].filter((value) => value && value !== userId))),
      {
        title: "Handover declined",
        message: `${actor.name} declined "${String(todo.title ?? "a todo")}".`,
        link: "/boards?tab=delegated-work",
        type: "deadline",
        company: handover.company ? String(handover.company) : null,
      },
    );
  } else {
    handover.status = "cancelled";
    handover.cancelledAt = now;
    handover.resolvedBy = userId;
    await handover.save();

    await BoardTodo.updateOne(
      { _id: handover.todo },
      {
        $set: { status: restoredStatus(progress), updatedBy: userId },
        $push: {
          delegationHistory: {
            from: handover.fromEmployee ?? null,
            to: handover.toEmployee,
            status: "cancelled",
            reason: String(body.reason ?? "Handover cancelled").slice(0, 1000),
            at: now,
          },
        },
      },
    );

    await notifyUsers(toId !== userId ? [toId] : [], {
      title: "Handover cancelled",
      message: `The handover of "${String(todo.title ?? "a todo")}" was cancelled.`,
      link: "/boards?tab=delegated-work",
      type: "info",
      company: handover.company ? String(handover.company) : null,
    });
  }

  const updated = await TaskHandover.findById(id)
    .populate("fromEmployee", "name email avatarUrl")
    .populate("toEmployee", "name email avatarUrl")
    .populate("requestedBy", "name email");

  await recordAudit({
    action: `board_todo.handover_${action}`,
    actionLabel: `Todo handover ${action}ed`,
    company: handover.company ? String(handover.company) : actor.company,
    actor: { id: userId, name: actor.name, role: actor.role },
    entityType: "TaskHandover",
    entityId: id,
    metadata: { todoId: String(handover.todo), status: String(handover.status) },
  });

  return NextResponse.json({ handover: serializeDoc(updated ?? handover), changed: true });
}
