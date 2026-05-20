import { Board } from "@/models/Board";
import { User } from "@/models/User";

export async function findAccessibleBoard(boardId: string, userId: string) {
  const board = await Board.findOne({
    _id: boardId,
    $or: [{ owner: userId }, { "members.user": userId }],
  });
  if (!board) return null;
  if (String(board.owner) === String(userId)) return board;

  const user = await User.findById(userId).select("company companyStatus");
  if (!user?.company || user.companyStatus !== "approved") {
    await Board.updateOne(
      { _id: boardId },
      { $pull: { members: { user: userId } } },
    );
    return null;
  }

  return board;
}

export function findOwnedBoard(boardId: string, userId: string) {
  return Board.findOne({
    _id: boardId,
    owner: userId
  });
}
