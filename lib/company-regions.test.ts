import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalRegionLabelOf,
  effectiveRegionApproverClause,
  effectiveRegionLabelOf,
  regionApproverClause,
} from "./company-regions.ts";

const company = {
  addresses: [
    { label: "Uttarakhand Region", isMain: true },
    { label: "Pune Region", isMain: false },
  ],
};

type LabelCondition = { $regex?: string; $options?: string; $in?: string[] };

function matchesRegionLabel(clause: Record<string, unknown>, label: string) {
  const parts: Record<string, LabelCondition>[] = Array.isArray(clause.$or)
    ? (clause.$or as Record<string, LabelCondition>[])
    : [clause as Record<string, LabelCondition>];
  return parts.some((part) => {
    const condition = part.regionLabel;
    if (!condition) return false;
    if (condition.$regex) {
      return new RegExp(String(condition.$regex), String(condition.$options ?? "")).test(label);
    }
    if (Array.isArray(condition.$in)) return condition.$in.includes(label);
    return false;
  });
}

test("canonicalRegionLabelOf resolves display and legacy labels to the office key", () => {
  assert.equal(canonicalRegionLabelOf(company, "Uttarakhand Region (Main Office)"), "Uttarakhand Region");
  assert.equal(canonicalRegionLabelOf(company, "uttarakhand region"), "Uttarakhand Region");
  assert.equal(canonicalRegionLabelOf(company, "main office"), "Uttarakhand Region");
  assert.equal(canonicalRegionLabelOf(company, "Pune Region"), "Pune Region");
  assert.equal(canonicalRegionLabelOf(company, "  "), "");
  assert.equal(canonicalRegionLabelOf(company, "Deleted Region"), "Deleted Region");
});

test("effectiveRegionLabelOf shows the canonical label for a stored display string", () => {
  assert.equal(
    effectiveRegionLabelOf(company, { regionLabel: "Uttarakhand Region (Main Office)" }),
    "Uttarakhand Region",
  );
  assert.equal(effectiveRegionLabelOf(company, { regionLabel: "" }), "Uttarakhand Region");
});

test("main office region clauses match both the canonical and suffixed label", () => {
  const clause = regionApproverClause(company, "Uttarakhand Region") as Record<string, unknown>;
  assert.equal(matchesRegionLabel(clause, "Uttarakhand Region"), true);
  assert.equal(matchesRegionLabel(clause, "Uttarakhand Region (Main Office)"), true);
  assert.equal(matchesRegionLabel(clause, "Pune Region"), false);

  const effective = effectiveRegionApproverClause(company, "Uttarakhand Region") as Record<string, unknown>;
  assert.equal(matchesRegionLabel(effective, "Uttarakhand Region (Main Office)"), true);
  assert.equal(matchesRegionLabel(effective, ""), true);
});

test("a suffixed requested region resolves to the main office too", () => {
  const clause = regionApproverClause(company, "Uttarakhand Region (Main Office)") as Record<string, unknown>;
  assert.equal(matchesRegionLabel(clause, "Uttarakhand Region"), true);
  assert.equal(matchesRegionLabel(clause, "Uttarakhand Region (Main Office)"), true);
});
