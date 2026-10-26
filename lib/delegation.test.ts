import test from "node:test";
import assert from "node:assert/strict";
import { featuresForRole, generateDelegationPin, safePinShape } from "./delegation.ts";

test("delegation PINs are always eight numeric digits, including zero padding", () => {
  for (let i = 0; i < 100; i += 1) {
    const pin = generateDelegationPin();
    assert.equal(pin.length, 8);
    assert.equal(safePinShape(pin), true);
  }
});

test("delegation features are limited by the authorizer role", () => {
  assert.ok(featuresForRole("human-resource").some((feature) => feature.key === "hr-onboarding"));
  assert.deepEqual(featuresForRole("employee"), []);
});

test("privileged roles expose their granular delegation catalog", () => {
  const finance = featuresForRole("finance").map((feature) => feature.key);
  assert.deepEqual(finance, [
    "finance-policy-editing",
    "finance-expense-requests",
    "finance-invoices",
    "finance-project-budgets",
    "finance-salaries",
    "finance-attendance-export",
    "finance-checkout-requests",
    "security-visitors",
  ]);
  assert.ok(featuresForRole("human-resource").some((feature) => feature.key === "recruitment-assessments"));
  assert.ok(featuresForRole("warehouse").some((feature) => feature.key === "warehouse-stock-movements"));
});
