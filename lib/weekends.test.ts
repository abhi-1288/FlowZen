import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  isWeekendDate,
  monthKey,
  normalizeDateOnly,
  regionApplies,
  weekendEntryForDate,
  weekendKeysForMonth,
  weekendLabel,
} from "./weekends.ts";

test("Sundays are weekends and Saturdays are not by default", () => {
  // 2026-11-01 is a Sunday, 2026-11-07 a Saturday.
  assert.equal(isWeekendDate("2026-11-01", {}), true);
  assert.equal(isWeekendDate("2026-11-07", {}), false);
});

test("assigning a Saturday does not stop Sundays being weekends", () => {
  const context = {
    weekendEntries: [{ date: "2026-11-07", reason: "Manual weekend" }],
  };
  assert.equal(isWeekendDate("2026-11-07", context), true);
  assert.equal(isWeekendDate("2026-11-01", context), true);
  assert.equal(isWeekendDate("2026-11-08", context), true);
  assert.equal(isWeekendDate("2026-11-14", context), false);
});

test("an exclusion makes a single Sunday a working day", () => {
  const context = {
    weekendEntries: [],
    weekendExclusions: [{ date: "2026-11-08", reason: "Working Sunday" }],
  };
  assert.equal(isWeekendDate("2026-11-01", context), true);
  assert.equal(isWeekendDate("2026-11-08", context), false);
  assert.equal(isWeekendDate("2026-11-15", context), true);
});

test("an exclusion wins over an explicit weekend entry", () => {
  const context = {
    weekendEntries: [{ date: "2026-11-07" }],
    weekendExclusions: [{ date: "2026-11-07" }],
  };
  assert.equal(isWeekendDate("2026-11-07", context), false);
});

test("regional entries only apply to their own region", () => {
  assert.equal(regionApplies("Pune", "Pune"), true);
  assert.equal(regionApplies("Pune", "Delhi"), false);
  assert.equal(regionApplies("", "Delhi"), true);
  assert.equal(regionApplies("Pune", ""), true);

  const puneWeekend = {
    weekendEntries: [{ date: "2026-11-07", region: "Pune", reason: "Pune day off" }],
    region: "Delhi",
  };
  assert.equal(isWeekendDate("2026-11-07", puneWeekend), false);
  assert.equal(
    isWeekendDate("2026-11-07", { ...puneWeekend, region: "Pune" }),
    true,
  );
});

test("month keys include default Sundays and explicit weekends only", () => {
  const keys = weekendKeysForMonth(
    { weekendEntries: [{ date: "2026-11-07" }] },
    2026,
    10,
  );
  assert.equal(keys.has("2026-11-01"), true); // Sunday
  assert.equal(keys.has("2026-11-07"), true); // assigned Saturday
  assert.equal(keys.has("2026-11-08"), true); // Sunday
  assert.equal(keys.has("2026-11-14"), false); // plain Saturday
  assert.equal(keys.size, 6); // five Sundays + the assigned Saturday
});

test("holiday weekend entries carry their reason", () => {
  const entry = weekendEntryForDate("2026-11-14", {
    weekendEntries: [
      { date: "2026-11-14", reason: "Diwali", kind: "holiday" },
    ],
  });
  assert.equal(weekendLabel(entry), "Holiday weekend: Diwali");
});

test("date keys handle date-only and UTC-midnight values", () => {
  assert.equal(dateKey("2026-11-07"), "2026-11-07");
  assert.equal(dateKey("2026-11-07T00:00:00.000Z"), "2026-11-07");
  assert.equal(dateKey(normalizeDateOnly("2026-11-07")), "2026-11-07");
  assert.equal(monthKey(2026, 10), "2026-11");
  assert.equal(dateKey(""), "");
});
