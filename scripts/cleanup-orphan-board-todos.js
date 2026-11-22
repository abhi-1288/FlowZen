// Removes continuity shadow BoardTodo records whose parent board Task no longer
// exists (or was never linked). Safe to run multiple times.
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const boardTodos = await db
    .collection("boardtodos")
    .find({ sourceType: "board_task", task: { $ne: null } })
    .project({ _id: 1, task: 1, title: 1 })
    .toArray();

  const taskIds = boardTodos.map((t) => t.task);
  const existing = await db
    .collection("tasks")
    .find({ _id: { $in: taskIds } })
    .project({ _id: 1 })
    .toArray();
  const existingSet = new Set(existing.map((t) => String(t._id)));

  const orphanIds = boardTodos
    .filter((t) => !existingSet.has(String(t.task)))
    .map((t) => t._id);

  if (orphanIds.length) {
    const res = await db.collection("boardtodos").deleteMany({ _id: { $in: orphanIds } });
    console.log(`Deleted ${res.deletedCount} orphaned board_task todos.`);
  } else {
    console.log("No orphaned board_task todos found.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
