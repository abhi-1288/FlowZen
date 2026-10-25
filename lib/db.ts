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
