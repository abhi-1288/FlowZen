import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST ?? "barcodes-lookup.p.rapidapi.com";
const LOOKUP_TIMEOUT_MS = 8000;

/**
 * Normalized product hints used to prefill the add-product form.
 * `found: false` means the external database has nothing for this code —
 * the client still lets the user create the product manually.
 */
export type BarcodeProduct = {
  found: boolean;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  brand: string;
  category: string;
  imageUrl: string;
};

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseCurrency(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value.includes("$")) return "$";
  if (value.includes("\u20ac")) return "\u20ac";
  if (value.includes("\u00a3")) return "\u00a3";
  if (value.includes("\u20b9")) return "\u20b9";
  return "";
}

/** Crude keyword mapping into the store's fixed category list. */
function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/\b(pen|pencil|marker|highlighter|stapler|scissor|glue|eraser|sharpener|stationery)\b/.test(t)) {
    return "stationery";
  }
  if (/\b(paper|notepad|envelope|sticky note|ream)\b/.test(t)) {
    return "paper";
  }
  if (/\b(book|novel|manual|guide|diary)\b/.test(t)) return "books";
  if (/\b(letterhead|letter head)\b/.test(t)) return "letterhead";
  if (
    /\b(phone|smartphone|charger|cable|battery|headphone|earbud|speaker|laptop|tablet|keyboard|mouse|monitor|camera|usb|adapter|electronics)\b/.test(
      t,
    )
  ) {
    return "electronics";
  }
  if (/\b(bag|case|cover|stand|holder|strap|accessory|accessories)\b/.test(t)) {
    return "accessories";
  }
  if (/\b(tape|cleaner|tissue|folder|file|clip|ink|toner)\b/.test(t)) {
    return "office-supplies";
  }
  return "other";
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return jsonError("Barcode lookup is not configured on this server.", 503);
  }

  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return jsonError("A barcode is required.", 400);
  if (code.length > 64) return jsonError("Invalid barcode.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("company companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to look up products.", 403);
  }

  const empty: BarcodeProduct = {
    found: false,
    name: "",
    description: "",
    price: null,
    currency: "",
    brand: "",
    category: "",
    imageUrl: "",
  };

  let data: { product?: unknown };
  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/?query=${encodeURIComponent(code)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      // Quota exhausted, upstream errors, etc. — degrade gracefully so the
      // user can still create the product manually.
      return NextResponse.json(empty);
    }

    data = await response.json().catch(() => ({}));
  } catch {
    return NextResponse.json(empty);
  }

  const product = data?.product;
  if (!product || typeof product !== "object") {
    return NextResponse.json(empty);
  }
  const info = product as Record<string, unknown>;

  const title = typeof info.title === "string" ? info.title.trim() : "";
  if (!title) return NextResponse.json(empty);

  const description =
    (typeof info.description === "string" && info.description.trim()) ||
    (Array.isArray(info.features) && info.features.length > 0
      ? info.features
          .filter((f: unknown): f is string => typeof f === "string")
          .slice(0, 3)
          .join(" \u00b7 ")
          .slice(0, 500)
      : "");

  const stores = Array.isArray(info.online_stores)
    ? (info.online_stores as Record<string, unknown>[])
    : [];
  const firstStore = stores[0];
  const price = parsePrice(firstStore?.price);
  const currency =
    parseCurrency(firstStore?.price) || parseCurrency(firstStore?.currency) || "";

  const brand =
    (typeof info.brand === "string" && info.brand.trim()) ||
    (typeof info.manufacturer === "string" && info.manufacturer.trim()) ||
    "";

  const fullText = `${title} ${description} ${brand}`;
  const rawCategory =
    typeof info.category === "string" ? info.category.trim() : "";

  const images = Array.isArray(info.images)
    ? (info.images as (string | { url?: unknown })[])
    : [];
  const imageUrl =
    typeof images[0] === "string"
      ? images[0]
      : typeof images[0]?.url === "string"
        ? images[0].url
        : "";

  return NextResponse.json({
    found: true,
    name: title.slice(0, 160),
    description: description.slice(0, 500),
    price,
    currency,
    brand: brand.slice(0, 80),
    category: guessCategory(`${fullText} ${rawCategory}`),
    imageUrl,
  } satisfies BarcodeProduct);
}
