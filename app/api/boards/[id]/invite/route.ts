import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { findOwnedBoard } from "@/lib/board-access";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";
import { emitToBoard } from "@/lib/socket-emit";

const BOARD_ROLES = ["admin", "manager", "employee", "tester", "others"] as const;

type Params = { params: Promise<{ id: string }> };

function normalizeBoardRole(value: unknown) {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "owner") return "admin";
  if (role === "project-manager") return "manager";
  if (role === "qa-tester") return "tester";
  if (role === "other") return "others";
  return BOARD_ROLES.includes(role as (typeof BOARD_ROLES)[number]) ? role : "employee";
}

function normalizeBoardMemberRoles(board: { members?: { role?: string }[] }) {
  board.members?.forEach((member) => {
    member.role = normalizeBoardRole(member.role);
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    if (!isObjectId(id)) return jsonError("Invalid board id.");

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = normalizeBoardRole(body.role);
    if (!email) return jsonError("Email is required.");

    await connectDb();
    const [board, invitedUser, caller] = await Promise.all([
      findOwnedBoard(id, userId).exec(),
      User.findOne({ email }).exec(),
      User.findById(userId).exec(),
    ]);

    if (!board) return jsonError("Only the owner can invite collaborators.", 403);
    if (!invitedUser) return jsonError("No user found for that email.", 404);
    if (!caller) return jsonError("Caller not found.", 404);

    normalizeBoardMemberRoles(board);
    const exists = board.members.some((member: any) => member.user.toString() === invitedUser._id.toString());
    if (!exists) {
      const at = new Date();
      board.members.push({ user: invitedUser._id, role });
      await board.save();

      await Promise.all([
        User.updateOne(
          { _id: invitedUser._id },
          {
            $push: {
              membershipHistory: {
                board: board._id,
                inviter: caller._id,
                action: "board-invite",
                at,
              },
            },
          },
        ),
        User.updateOne(
          { _id: caller._id },
          {
            $push: {
              membershipHistory: {
                board: board._id,
                invitee: invitedUser._id,
                action: "board-invite",
                at,
              },
            },
          },
        ),
        Notification.create({
          user: invitedUser._id,
          board: board._id,
          title: "Board invitation",
          message: `${caller.name}: ${caller.role} has invited you to ${board.title}.`,
        }),
      ]);
      emitNotification(String(invitedUser._id));
      emitToBoard(board, "board:update", { id: String(board._id) });
    }

    const freshBoard = await Board.findById(id)
      .populate("members.user", "name email")
      .populate("members.assignedTo", "name email");
    if (!freshBoard) return jsonError("Board not found.", 404);
    return NextResponse.json({ board: serializeDoc(freshBoard) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonError(message, 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);
    if (!isObjectId(id)) return jsonError("Invalid board id.");

    const body = await request.json();
    const memberId = String(body.memberId ?? "");
    if (!isObjectId(memberId)) return jsonError("Invalid member id.");

    await connectDb();
    const [board, caller, removedUser] = await Promise.all([
      Board.findOne({ _id: id, "members.user": userId }).exec(),
      User.findById(userId).exec(),
      User.findById(memberId).exec(),
    ]);
    if (!board) return jsonError("Board not found.", 404);
    if (!caller) return jsonError("Caller not found.", 404);
    if (!removedUser) return jsonError("Member not found.", 404);
    const isOwner = String(board.owner) === userId;
    const isSelfRemoval = memberId === userId;
    
    const targetMember = board.members.find((m: any) => String(m.user) === memberId);
    const isLeadRemoval = targetMember && String(targetMember.assignedTo) === userId;

    if (!isOwner && !isSelfRemoval && !isLeadRemoval) {
      return jsonError("Only the owner, the lead manager, or the member themselves can remove access.", 403);
    }
    if (String(board.owner) === memberId) return jsonError("Board owner cannot be removed.", 400);

    normalizeBoardMemberRoles(board);
    const wasMember = board.members.some((member: any) => member.user.toString() === memberId);
    if (wasMember) {
      const at = new Date();
      board.members = board.members.filter((member: any) => member.user.toString() !== memberId);
      await board.save();

      await Promise.all([
        User.updateOne(
          { _id: removedUser._id },
          {
            $push: {
              membershipHistory: {
                board: board._id,
                inviter: caller._id,
                action: "board-remove",
                at,
              },
            },
          },
        ),
        User.updateOne(
          { _id: caller._id },
          {
            $push: {
              membershipHistory: {
                board: board._id,
                invitee: removedUser._id,
                action: "board-remove",
                at,
              },
            },
          },
        ),
        Notification.create({
          user: removedUser._id,
          board: board._id,
          title: "Board access removed",
          message: `${caller.name}: ${caller.role} has removed you from ${board.title}.`,
        }),
      ]);
      emitNotification(String(removedUser._id));
      emitToBoard(board, "board:update", { id: String(board._id) });
    }

    const freshBoard = await Board.findById(id)
      .populate("members.user", "name email")
      .populate("members.assignedTo", "name email");
    if (!freshBoard) return jsonError("Board not found.", 404);
    return NextResponse.json({ board: serializeDoc(freshBoard), removedSelf: isSelfRemoval });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonError(message, 500);
  }
}
