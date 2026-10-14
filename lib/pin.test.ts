import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PIN_IDLE_TIMEOUT_MS,
  PIN_MAX_FAILED_ATTEMPTS,
  PIN_LOCKOUT_BASE_MS,
  PIN_LOCKOUT_MAX_MS,
  isPinLength,
  validatePin,
  generateGreenPin,
  computeLockState,
  computeLockout,
  lockoutSecondsRemaining,
} from "./pin.ts";

test("isPinLength accepts only 4 and 6", () => {
  assert.equal(isPinLength(4), true);
  assert.equal(isPinLength(6), true);
  assert.equal(isPinLength(5), false);
  assert.equal(isPinLength("4"), false);
  assert.equal(isPinLength(null), false);
});

test("validatePin accepts valid 4 and 6 digit PINs", () => {
  const four = validatePin("1359");
  assert.equal(four.ok, true);
  if (four.ok) {
    assert.equal(four.pin, "1359");
    assert.equal(four.length, 4);
  }
  const six = validatePin("135790");
  assert.equal(six.ok, true);
  if (six.ok) assert.equal(six.length, 6);
});

test("validatePin rejects non-numeric input", () => {
  for (const bad of ["abcd", "12a4", "12 34", "", " ", "-1234", "12.34"]) {
    assert.equal(validatePin(bad).ok, false, `expected ${JSON.stringify(bad)} to fail`);
  }
  assert.equal(validatePin(12345).ok, false);
  assert.equal(validatePin(null).ok, false);
  assert.equal(validatePin(undefined).ok, false);
});

test("validatePin rejects wrong lengths", () => {
  assert.equal(validatePin("123").ok, false);
  assert.equal(validatePin("12345").ok, false);
  assert.equal(validatePin("1234567").ok, false);
});

test("validatePin enforces an expected length when provided", () => {
  assert.equal(validatePin("135790", 4).ok, false);
  assert.equal(validatePin("1359", 6).ok, false);
  assert.equal(validatePin("1359", 4).ok, true);
});

test("validatePin rejects repeated digits (sequential patterns are allowed)", () => {
  for (const bad of ["0000", "1111", "999999"]) {
    assert.equal(validatePin(bad).ok, false, `expected ${bad} to be rejected`);
  }
  for (const good of ["1234", "4321", "123456", "654321", "0123", "9876", "1357", "135790"]) {
    assert.equal(validatePin(good).ok, true, `expected ${good} to be accepted`);
  }
});

test("generateGreenPin produces valid PINs of the requested length", () => {
  for (const length of [4, 6] as const) {
    const pin = generateGreenPin(length);
    const validation = validatePin(pin, length);
    assert.equal(validation.ok, true);
    if (validation.ok) assert.equal(validation.pin, pin);
  }
  assert.notEqual(generateGreenPin(4), generateGreenPin(8 as never));
});

test("computeLockState returns false when no PIN is enabled", () => {
  const now = 1_000_000_000_000;
  assert.equal(
    computeLockState({
      pinEnabled: false,
      locked: true,
      lastActiveAt: now - PIN_IDLE_TIMEOUT_MS * 10,
      now,
      unlockedPinVersion: 0,
      pinVersion: 5,
    }),
    false,
  );
});

test("computeLockState locks when explicitly locked", () => {
  const now = 1_000_000_000_000;
  assert.equal(
    computeLockState({
      pinEnabled: true,
      locked: true,
      lastActiveAt: now,
      now,
      unlockedPinVersion: 1,
      pinVersion: 1,
    }),
    true,
  );
});

test("computeLockState locks when the PIN changed since last unlock", () => {
  const now = 1_000_000_000_000;
  assert.equal(
    computeLockState({
      pinEnabled: true,
      locked: false,
      lastActiveAt: now,
      now,
      unlockedPinVersion: 1,
      pinVersion: 2,
    }),
    true,
  );
});

test("computeLockState locks after the idle timeout", () => {
  const now = 1_000_000_000_000;
  assert.equal(
    computeLockState({
      pinEnabled: true,
      locked: false,
      lastActiveAt: now - PIN_IDLE_TIMEOUT_MS - 1,
      now,
      unlockedPinVersion: 1,
      pinVersion: 1,
    }),
    true,
  );
  assert.equal(
    computeLockState({
      pinEnabled: true,
      locked: false,
      lastActiveAt: now - PIN_IDLE_TIMEOUT_MS + 1000,
      now,
      unlockedPinVersion: 1,
      pinVersion: 1,
    }),
    false,
  );
});

test("computeLockState treats a missing activity timestamp as idle", () => {
  assert.equal(
    computeLockState({
      pinEnabled: true,
      locked: false,
      lastActiveAt: 0,
      now: 1_000_000_000_000,
      unlockedPinVersion: 1,
      pinVersion: 1,
    }),
    true,
  );
});

test("computeLockout stays null under the threshold", () => {
  const now = 1_000_000_000_000;
  assert.equal(computeLockout(0, now), null);
  assert.equal(computeLockout(PIN_MAX_FAILED_ATTEMPTS - 1, now), null);
});

test("computeLockout starts at the base duration and doubles with backoff", () => {
  const now = 1_000_000_000_000;
  assert.equal(computeLockout(PIN_MAX_FAILED_ATTEMPTS, now), now + PIN_LOCKOUT_BASE_MS);
  assert.equal(computeLockout(PIN_MAX_FAILED_ATTEMPTS + 1, now), now + PIN_LOCKOUT_BASE_MS * 2);
  assert.equal(computeLockout(PIN_MAX_FAILED_ATTEMPTS + 2, now), now + PIN_LOCKOUT_BASE_MS * 4);
});

test("computeLockout caps at the maximum and extends an active lockout", () => {
  const now = 1_000_000_000_000;
  const capped = computeLockout(PIN_MAX_FAILED_ATTEMPTS + 10, now);
  assert.equal(capped, now + PIN_LOCKOUT_MAX_MS);

  const activeUntil = now + 5_000;
  const extended = computeLockout(PIN_MAX_FAILED_ATTEMPTS, now, activeUntil);
  assert.equal(extended, activeUntil + PIN_LOCKOUT_BASE_MS);
});

test("lockoutSecondsRemaining is clamped and rounded up", () => {
  const now = 1_000_000_000_000;
  assert.equal(lockoutSecondsRemaining(null, now), 0);
  assert.equal(lockoutSecondsRemaining(now - 5000, now), 0);
  assert.equal(lockoutSecondsRemaining(now + 1500, now), 2);
  assert.equal(lockoutSecondsRemaining(now + 10_000, now), 10);
});
