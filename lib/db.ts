import mongoose from "mongoose";
// Ensure mongoose model schemas are registered when the DB module is imported
import "@/models";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: CachedConnection | undefined;
}

const cached = global.mongooseConnection ?? { conn: null, promise: null };

if (!global.mongooseConnection) {
  global.mongooseConnection = cached;
}

export async function connectDb() {
  const MONGODB_URI = process.env.NODE_ENV === "production" ? process.env.ATLAS_URI : process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (cached.conn) return cached.conn;

  cached.promise ??= mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000
  });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
