import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodoSnapshot,
  carryForwardKey,
  categoryForTodo,
  compactionIdempotencyKey,
  consolidateTeamReports,
  consolidateTodos,
  contentFromSnapshots,
  dateKeyInTimeZone,
  dateFromKey,
  deliveryEventKey,
  hasCompactionContent,
  rollupSnapshots,
  weekKeyInTimeZone,
  weekRangeInTimeZone,
} from "./compaction.ts";

test("date keys and week keys use the company timezone", () => {
  // 2026-11-12T20:30Z is already 2026-11-13 in IST.
  assert.equal(dateKeyInTimeZone("2026-11-12T20:30:00Z", "Asia/Kolkata"), "2026-11-13");
  assert.equal(dateKeyInTimeZone("2026-11-12T20:30:00Z", "UTC"), "2026-11-12");
  assert.equal(weekKeyInTimeZone("2026-11-12T10:00:00Z", "Asia/Kolkata"), "2026-W46");
  const range = weekRangeInTimeZone("2026-11-12T10:00:00Z", "Asia/Kolkata");
  assert.equal(dateKeyInTimeZone(range.start, "Asia/Kolkata"), "2026-11-09");
  assert.equal(dateKeyInTimeZone(range.end, "Asia/Kolkata"), "2026-11-15");
});

test("dateFromKey round-trips the local calendar day", () => {
  const instant = dateFromKey("2026-11-13", "Asia/Kolkata");
  assert.equal(dateKeyInTimeZone(instant, "Asia/Kolkata"), "2026-11-13");
  assert.equal(instant.toISOString(), "2026-11-12T18:30:00.000Z");
});

test("carry-forward and compaction keys are deterministic", () => {
  assert.equal(carryForwardKey("abc", "2026-11-13"), "cf:abc:2026-11-13");
  assert.equal(
    compactionIdempotencyKey("EOD", "u1", "2026-11-13"),
    "EOD:u1:2026-11-13",
  );
  assert.equal(
    deliveryEventKey("compaction", "c1", "u2", "email"),
    "compaction:c1:u2:email",
  );
});

test("unfinished work is never categorised as completed", () => {
  assert.equal(categoryForTodo({ status: "completed", progress: 100 }), "completed");
  assert.equal(categoryForTodo({ status: "approved", progress: 100 }), "completed");
  assert.equal(categoryForTodo({ status: "in_progress", progress: 100 }), "partial");
  assert.equal(categoryForTodo({ status: "not_started", progress: 100 }), "pending");
  assert.equal(categoryForTodo({ status: "blocked", progress: 40 }), "blocked");
  assert.equal(categoryForTodo({ status: "partially_completed", progress: 0 }), "partial");
  assert.equal(categoryForTodo({ status: "in_progress", progress: 20 }), "partial");
});

test("snapshot keeps original assignment dates during carry-forward", () => {
  const snapshot = buildTodoSnapshot({
    _id: "todo-2",
    title: "Ship report",
    status: "carried_forward",
    progress: 60,
    originalAssignedDate: new Date("2026-11-01T00:00:00Z"),
    currentWorkingDate: new Date("2026-11-13T00:00:00Z"),
    remainingWork: "Finish charts",
  });
  assert.equal(snapshot.originalAssignedDate?.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(snapshot.currentWorkingDate?.toISOString(), "2026-11-13T00:00:00.000Z");
  assert.equal(snapshot.category, "partial");
});

test("empty compactions are detected before persistence", () => {
  const empty = contentFromSnapshots([]);
  assert.equal(hasCompactionContent(empty), false);
  const snapshots = [
    buildTodoSnapshot({ _id: "t1", title: "Work", status: "completed", progress: 100 }),
  ];
  const rollup = rollupSnapshots(snapshots);
  assert.equal(rollup.hasWork, true);
  assert.equal(rollup.metrics.completed, 1);
  assert.equal(hasCompactionContent(contentFromSnapshots(snapshots)), true);
});

test("team consolidation dedupes the same todo and keeps every source link", () => {
  const first = buildTodoSnapshot({
    _id: "same-todo",
    title: "Shared launch task",
    status: "in_progress",
    progress: 50,
  });
  const second = buildTodoSnapshot({
    _id: "same-todo",
    title: "Shared launch task",
    status: "completed",
    progress: 100,
  });
  const deduped = consolidateTodos([
    {
      employee: "u1",
      employeeName: "Asha",
      sourceCompactionId: "c1",
      compactionType: "EOD",
      summary: "",
      content: contentFromSnapshots([first]),
      todos: [first],
    },
    {
      employee: "u2",
      employeeName: "Ravi",
      sourceCompactionId: "c2",
      compactionType: "EOD",
      summary: "",
      content: contentFromSnapshots([second]),
      todos: [second],
    },
  ]);
  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].employees, ["u1", "u2"]);
  assert.deepEqual(deduped[0].sourceCompactionIds, ["c1", "c2"]);
  assert.equal(deduped[0].sourceLinks.length, 2);
});

test("team consolidation lists missing reports and exclusion reasons", () => {
  const result = consolidateTeamReports({
    teamName: "Platform",
    teamOwnerName: "Meera",
    periodStart: new Date("2026-11-09T00:00:00Z"),
    periodEnd: new Date("2026-11-15T23:59:59Z"),
    expectedEmployees: [
      { employee: "u1", employeeName: "Asha", employeeCode: "E1" },
      { employee: "u2", employeeName: "Ravi", employeeCode: "E2" },
      { employee: "u3", employeeName: "Neha", employeeCode: "E3" },
    ],
    sources: [
      {
        employee: "u1",
        employeeName: "Asha",
        sourceCompactionId: "c1",
        compactionType: "EOD",
        summary: "Done",
        content: contentFromSnapshots([]),
        todos: [],
      },
    ],
    exclusionReasons: ["Ravi's draft was withdrawn"],
  });
  assert.deepEqual(result.content.overview.missingReports, ["Ravi (E2)", "Neha (E3)"]);
  assert.deepEqual(result.content.overview.exclusionReasons, ["Ravi's draft was withdrawn"]);
  assert.equal(result.content.overview.receivedReports, 1);
});
