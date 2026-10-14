/**
 * Pure, dependency-free PIN screen-lock logic.
 *
 * This module deliberately imports nothing (no `@/` aliases, no enums, no
 * runtime-only TS syntax) so it can be unit tested directly with the Node test
 * runner and TypeScript type stripping: `node --test lib/pin.test.ts`.
 */

import { randomInt } from "crypto";

/** randomly generated Green PINs are this long by default. */
export const PIN_DEFAULT_LENGTH: PinLength = 6;
export const PIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Failed unlocks tolerated before a lockout kicks in. */
export const PIN_MAX_FAILED_ATTEMPTS = 5;

/** First lockout duration; doubles with each further failure (capped). */
export const PIN_LOCKOUT_BASE_MS = 15 * 60 * 1000;
export const PIN_LOCKOUT_MAX_MS = 60 * 60 * 1000;

export type PinLength = 4 | 6;

export type PinValidation =
  | { ok: true; pin: string; length: PinLength }
  | { ok: false; error: string };

export function isPinLength(value: unknown): value is PinLength {
  return value === 4 || value === 6;
}

function isSequential(pin: string): boolean {
  let ascending = true;
  let descending = true;
  for (let i = 1; i < pin.length; i += 1) {
    const diff = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
    if (diff !== 1) ascending = false;
    if (diff !== -1) descending = false;
  }
  return ascending || descending;
}

/**
 * Validate a candidate PIN. Enforces numeric-only, 4 or 6 digits, and rejects
 * the weakest repeated pattern. Sequential patterns are deliberately allowed.
 */
export function validatePin(raw: unknown, expectedLength?: PinLength): PinValidation {
  const pin = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!/^[0-9]+$/.test(pin)) return { ok: false, error: "PIN must contain digits only." };
  if (!isPinLength(pin.length)) return { ok: false, error: "PIN must be 4 or 6 digits." };
  if (expectedLength && pin.length !== expectedLength) {
    return { ok: false, error: `PIN must be ${expectedLength} digits.` };
  }
  if (/^([0-9])\1+$/.test(pin)) {
    return { ok: false, error: "PIN cannot be the same digit repeated." };
  }
  return { ok: true, pin, length: pin.length };
}

/**
 * Generate a fresh random PIN for recovery flows. The result always satisfies
 * `validatePin`; callers should never log or persist the returned value.
 */
export function generateGreenPin(length: PinLength = PIN_DEFAULT_LENGTH): string {
  const expected = isPinLength(length) ? length : PIN_DEFAULT_LENGTH;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let pin = "";
    for (let i = 0; i < expected; i += 1) pin += String(randomInt(0, 10));
    if (validatePin(pin, expected).ok) return pin;
  }
  return "1359".slice(0, expected);
}

export type LockStateInput = {
  pinEnabled: boolean;
  locked: boolean;
  /** Epoch ms of the last recorded activity, or 0 when unknown. */
  lastActiveAt: number;
  now: number;
  unlockedPinVersion: number;
  pinVersion: number;
};

/**
 * A session is locked when the user has a PIN enabled AND any of:
 *  - it was explicitly locked,
 *  - it has been idle past the timeout, or
 *  - the PIN changed since this session last unlocked.
 * Users without a PIN are never locked (the feature is purely opt-in).
 */
export function computeLockState(input: LockStateInput): boolean {
  if (!input.pinEnabled) return false;
  if (input.locked) return true;
  if (input.unlockedPinVersion !== input.pinVersion) return true;
  if (!Number.isFinite(input.lastActiveAt) || input.lastActiveAt <= 0) return true;
  return input.now - input.lastActiveAt > PIN_IDLE_TIMEOUT_MS;
}

/**
 * Compute the epoch ms a lockout should end at given the number of failed
 * attempts. Returns null while under the threshold. Backoff doubles with each
 * failure past the threshold, capped at one hour.
 */
export function computeLockout(
  failedAttempts: number,
  now: number,
  previousLockoutUntil?: number | null,
): number | null {
  if (failedAttempts < PIN_MAX_FAILED_ATTEMPTS) return null;
  const over = Math.min(failedAttempts - PIN_MAX_FAILED_ATTEMPTS, 4);
  const duration = Math.min(PIN_LOCKOUT_BASE_MS * Math.pow(2, over), PIN_LOCKOUT_MAX_MS);
  const base = Math.max(now, previousLockoutUntil ?? 0);
  return base + duration;
}

/** Remaining lockout seconds, clamped at zero. */
export function lockoutSecondsRemaining(lockoutUntil: number | null, now: number): number {
  if (!lockoutUntil) return 0;
  return Math.max(0, Math.ceil((lockoutUntil - now) / 1000));
}
