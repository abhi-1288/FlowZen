import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * One document per authenticated session (per device / browser). The `sessionId`
 * is a stable random value carried inside the signed NextAuth JWT, so it cannot
 * be forged from the client. Tabs on one device share a cookie and therefore a
 * single session lock, while each device keeps its own independent lock state.
 *
 * This collection is the server-side source of truth for whether a session is
 * currently locked. It stores no PIN material whatsoever — only the hash lives
 * on the User (see `User.pinHash`).
 */
const SessionLockSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Snapshot of the user's PIN config at the time this session was synced.
    // `pinVersion` is refreshed for all of a user's sessions whenever the PIN
    // changes, which relocks sessions still holding an older version.
    pinEnabled: { type: Boolean, default: false },
    pinLength: { type: Number, enum: [4, 6], default: null },
    pinVersion: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    // The pinVersion this session last unlocked against. A mismatch with
    // `pinVersion` means the PIN changed elsewhere and this session must relock.
    unlockedPinVersion: { type: Number, default: 0 },
    unlockMethod: { type: String, enum: ["login", "pin"], default: "login" },
    failedAttempts: { type: Number, default: 0, min: 0 },
    lastFailedAt: { type: Date, default: null },
    lockoutUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

SessionLockSchema.index({ user: 1, lastActiveAt: -1 });
// Sessions are long-lived (the NextAuth JWT lasts a year). Expire the lock
// record a little after the longest plausible session so the collection does
// not grow forever; a fresh login recreates it lazily.
SessionLockSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 366 * 24 * 60 * 60 });

export type SessionLockDocument = InferSchemaType<typeof SessionLockSchema>;

if (process.env.NODE_ENV === "development") {
  delete (models as any).SessionLock;
}

export const SessionLock =
  (models as any).SessionLock || model("SessionLock", SessionLockSchema);
