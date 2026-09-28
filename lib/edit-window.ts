import { utcWallClockNow } from "@/lib/date-utils";

/**
 * The application-editing window rules.
 *
 * Split out of `lib/recruitment-utils.ts` and kept free of database and socket
 * imports, because the HR job page and the candidate portal import this from
 * `"use client"` files. `recruitment-utils.ts` re-exports it, so server code
 * still has a single import to reach. Anything needed on both sides of the
 * client/server boundary belongs in this file; anything touching the database
 * does not.
 */

/** Candidate portal tokens live 30 days; see lib/candidate-portal.ts. */
const PORTAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Longest editing window HR may set.
 *
 * Bounded by the candidate portal token's own 30-day lifetime, not by anything
 * about the feature. A token is minted (or rotated) when editing is enabled and
 * stops resolving 30 days later, so a deadline past that point would be
 * unreachable for exactly the candidates it was meant to serve. 25 days leaves
 * room for the enable to be re-issued without the deadline silently becoming a
 * lie.
 */
export const MAX_EDIT_WINDOW_MS = PORTAL_TOKEN_TTL_MS - 5 * 24 * 60 * 60 * 1000;

export type EditWindowState = {
  /** The raw stored flag, true even once the window has lapsed. */
  enabled: boolean;
  /** Whether a candidate may currently change their application. */
  open: boolean;
  /** True when editing is on and the deadline has passed. */
  expired: boolean;
  /** The stored deadline, if any. */
  closeAt: Date | null;
  msRemaining: number | null;
};

/** Minimal shape needed, so a mongoose document and a plain object both work. */
type EditWindowJob = {
  editApplicationsEnabled?: boolean | null;
  editApplicationsCloseAt?: Date | string | null;
} | null | undefined;

/**
 * Whether a job's application-editing window is open, and how much is left.
 *
 * Single source of truth on purpose. The candidate's PATCH gate, the portal
 * button, and the sweep that flips the stored boolean all call this, so they
 * cannot drift into disagreeing about whether editing is allowed.
 *
 * `editApplicationsCloseAt` is a UTC wall clock (lib/date-utils), so it is
 * compared against `utcWallClockNow()` rather than the raw instant. Note that
 * `open` is computed here and not merely read from `editApplicationsEnabled`:
 * the effective window closes on time even if no cron has run to clear the flag,
 * so a missed sweep delays the notification but never the deadline.
 */
export function isEditWindowOpen(job: EditWindowJob, nowMs: number = utcWallClockNow()): EditWindowState {
  const enabled = job?.editApplicationsEnabled === true;
  const raw = job?.editApplicationsCloseAt;
  const closeAt = raw ? new Date(raw) : null;
  const valid = closeAt && !Number.isNaN(closeAt.getTime()) ? closeAt : null;

  if (!enabled) {
    return { enabled: false, open: false, expired: false, closeAt: valid, msRemaining: null };
  }

  if (!valid) {
    return { enabled: true, open: true, expired: false, closeAt: null, msRemaining: null };
  }

  const remaining = valid.getTime() - nowMs;
  return {
    enabled: true,
    open: remaining > 0,
    expired: remaining <= 0,
    closeAt: valid,
    msRemaining: remaining,
  };
}

/**
 * Validates an editing deadline HR typed in.
 *
 * Returns a discriminated result, so the caller gets the parsed `closeAt` without
 * re-checking the message. A deadline in the past is rejected rather than
 * accepted: it would open a window that is already shut, which reads to the
 * candidate as a broken button rather than a mistake by HR.
 */
export function validateEditWindowDeadline(
  value: unknown,
  nowMs: number = utcWallClockNow()
): { ok: true; closeAt: Date } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: false, error: "Choose a date and time for the editing window to close." };
  }
  const closeAt = new Date(value as string);
  if (Number.isNaN(closeAt.getTime())) {
    return { ok: false, error: "That closing date and time could not be read." };
  }
  if (closeAt.getTime() <= nowMs) {
    return { ok: false, error: "The editing window must close in the future, not in the past." };
  }
  if (closeAt.getTime() - nowMs > MAX_EDIT_WINDOW_MS) {
    return {
      ok: false,
      error: `The editing window can run for at most ${Math.round(
        MAX_EDIT_WINDOW_MS / (24 * 60 * 60 * 1000)
      )} days, because candidate portal links expire after 30.`,
    };
  }
  return { ok: true, closeAt };
}
