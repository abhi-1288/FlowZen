import { Schema, model, models, type InferSchemaType } from "mongoose";

const GameScoreSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    game: {
      type: String,
      enum: ["reaction", "memory", "pattern", "typing", "number"],
      required: true,
      index: true,
    },
    bestScore: { type: Number, default: 0 },
    lastScore: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    bestAt: { type: Date, default: null },
  },
  { timestamps: true }
);

GameScoreSchema.index({ user: 1, company: 1, game: 1 }, { unique: true });

export type GameScoreDocument = InferSchemaType<typeof GameScoreSchema>;
if (process.env.NODE_ENV === "development") {
  delete (models as any).GameScore;
}

export const GameScore = models.GameScore || model("GameScore", GameScoreSchema);
