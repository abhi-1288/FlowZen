import { Schema, model, models, type InferSchemaType } from "mongoose";

const GameChallengeSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    game: {
      type: String,
      enum: ["reaction", "memory", "pattern", "typing", "number"],
      required: true,
    },
    score: { type: Number, default: 0 },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
      index: true,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

GameChallengeSchema.index({ to: 1, status: 1 });
GameChallengeSchema.index({ from: 1, status: 1 });

export type GameChallengeDocument = InferSchemaType<typeof GameChallengeSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).GameChallenge;
}

export const GameChallenge = models.GameChallenge || model("GameChallenge", GameChallengeSchema);
