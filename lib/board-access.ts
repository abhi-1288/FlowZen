import { Board } from "@/models/Board";

export function findAccessibleBoard(boardId: string, userId: string) {
  return Board.findOne({
    _id: boardId,
    "members.user": userId
  });
}

export function findOwnedBoard(boardId: string, userId: string) {
  return Board.findOne({
    _id: boardId,
    owner: userId
  });
}
