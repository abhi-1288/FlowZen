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

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Connection settings tuned for running several app instances behind a load
 * balancer.
 *
 * The pool is per process. With N replicas the cluster opens up to
 * `N * maxPoolSize` sockets, so keep the product inside the database plan's
 * connection limit (Atlas shows it as "Connections"). 10 is a safe default for
 * serverless-style deployments where many short-lived instances can exist;
 * raise it for long-lived containers with a known replica count.
 *
 * `compressors` enables wire compression, which meaningfully cuts bytes for
 * the large list/document payloads this API returns. `waitQueueTimeoutMS`
 * makes a saturated pool fail fast instead of letting requests hang and pile
 * up behind one another.
 */
function connectOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const maxPoolSize = positiveInt(process.env.MONGODB_MAX_POOL_SIZE, isProduction ? 10 : 5);
  const compressors = (process.env.MONGODB_COMPRESSORS ?? "zlib")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean) as ("zlib" | "snappy" | "zstd")[];
  const minPoolSize = Math.min(
    positiveInt(process.env.MONGODB_MIN_POOL_SIZE, isProduction ? 2 : 0),
    maxPoolSize,
  );

  return {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: positiveInt(process.env.MONGODB_CONNECT_TIMEOUT_MS, 10_000),
    maxPoolSize,
    minPoolSize,
    maxConnecting: positiveInt(process.env.MONGODB_MAX_CONNECTING, 4),
    maxIdleTimeMS: positiveInt(process.env.MONGODB_MAX_IDLE_TIME_MS, 30_000),
    waitQueueTimeoutMS: positiveInt(process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS, 10_000),
    // zlib is supported by every MongoDB server; the driver silently skips
    // compression when the server cannot negotiate it.
    compressors,
    retryWrites: true,
    appName: process.env.MONGODB_APP_NAME ?? "flowzen",
  };
}

if (!global.mongooseConnection) {
  global.mongooseConnection = cached;
}

export async function connectDb() {
  const MONGODB_URI = process.env.NODE_ENV === "production" ? process.env.ATLAS_URI : process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (cached.conn) return cached.conn;

  cached.promise ??= mongoose.connect(MONGODB_URI, connectOptions());

  try {
    cached.conn = await cached.promise;

    // Self-heal the store catalogue index for the barcode feature: an older
    // schema left a unique index on `barcode` that treated every null/empty
    // value as a duplicate. Drop it and recreate it as a partial index so
    // products without a barcode can coexist, then backfill legacy rows.
    try {
      const storeItemModel = mongoose.models.StoreItem;
      if (storeItemModel?.collection) {
        await storeItemModel.collection.dropIndex("company_1_regionLabel_1_barcode_1").catch(() => {});
        await storeItemModel.collection.createIndex(
          { company: 1, regionLabel: 1, barcode: 1 },
          {
            unique: true,
            partialFilterExpression: { barcode: { $gt: "" } },
            name: "company_1_regionLabel_1_barcode_1",
          },
        );
        await storeItemModel.updateMany(
          { $or: [{ barcode: { $exists: false } }, { barcode: null }] },
          { $set: { barcode: "" } },
        );
      }
    } catch {
      // Index self-heal is best-effort; never block DB connection.
    }

    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
