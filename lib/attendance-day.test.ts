import test from "node:test";
import assert from "node:assert/strict";
import { attendanceDay, attendanceDayKey, sameAttendanceDay } from "./attendance-day.ts";

test("attendanceDay anchors the company-local day to UTC midnight", () => {
  // 2026-11-12T20:30Z is already 2026-11-13 in IST.
  assert.equal(attendanceDay("2026-11-12T20:30:00Z", "Asia/Kolkata").toISOString(), "2026-11-13T00:00:00.000Z");
  assert.equal(attendanceDay("2026-11-12T20:30:00Z", "UTC").toISOString(), "2026-11-12T00:00:00.000Z");
});

test("attendanceDayKey follows the company timezone", () => {
  assert.equal(attendanceDayKey("2026-11-12T20:30:00Z", "Asia/Kolkata"), "2026-11-13");
  assert.equal(attendanceDayKey("2026-11-12T20:30:00Z", "UTC"), "2026-11-12");
  // An invalid/omitted timezone falls back to IST.
  assert.equal(attendanceDayKey("2026-11-12T20:30:00Z"), "2026-11-13");
});

test("sameAttendanceDay compares company-local days, not instants", () => {
  const early = "2026-11-12T20:30:00Z"; // 2026-11-13 02:00 IST
  const late = "2026-11-13T18:00:00Z"; // 2026-11-13 23:30 IST
  const nextDay = "2026-11-13T19:00:00Z"; // 2026-11-14 00:30 IST
  assert.equal(sameAttendanceDay(early, late, "Asia/Kolkata"), true);
  assert.equal(sameAttendanceDay(late, nextDay, "Asia/Kolkata"), false);
  // Same instants, different company zone: 20:30Z is 12-13 in UTC.
  assert.equal(sameAttendanceDay(early, late, "UTC"), false);
});
