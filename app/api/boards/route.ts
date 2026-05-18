import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { requireUserId, serializeDocs, serializeDoc, jsonError } from "@/lib/api";

const DEFAULT_COLUMNS = ["Todo", "In Progress", "Done", "Expired-due"];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const boards = await Board.find({ "members.user": userId }).sort({ updatedAt: -1 });
  return NextResponse.json({ boards: serializeDocs(boards) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!title) return jsonError("Board title is required.");

  await connectDb();
  const board = await Board.create({
    title,
    description,
    owner: userId,
    members: [{ user: userId, role: "admin" }]
  });

  await Column.insertMany(
    DEFAULT_COLUMNS.map((columnTitle, order) => ({
      board: board._id,
      title: columnTitle,
      order
    }))
  );

  return NextResponse.json({ board: serializeDoc(board) }, { status: 201 });
}

