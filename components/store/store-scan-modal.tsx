"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  Check,
  Keyboard,
  Loader2,
  PackagePlus,
  ScanLine,
  X,
} from "lucide-react";

import { apiFetch } from "@/lib/client-utils";
import { categoryLabel } from "@/lib/store-constants";

type ScanItem = {
  id: string;
  name: string;
  productNumber: string;
  batchNumber: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  stock: number;
};

type SessionEntry = {
  key: string;
  name: string;
  qty: number;
  at: string;
};

type ExternalProduct = {
  found: boolean;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  brand: string;
  category: string;
  imageUrl: string;
};

type NewProductPrefill = {
  name?: string;
  description?: string;
  price?: string;
  category?: string;
};

const READER_ID = "store-scan-reader";
const SCAN_COOLDOWN_MS = 2000;

export function StoreScanModal({
  onClose,
  onStocked,
  onUnknownCode,
}: {
  onClose: () => void;
  onStocked: () => void;
  onUnknownCode: (code: string, prefill?: NewProductPrefill) => void;
}) {
  const [codeInput, setCodeInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [matched, setMatched] = useState<ScanItem | null>(null);
  const [notFoundCode, setNotFoundCode] = useState("");
  const [external, setExternal] = useState<ExternalProduct | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [checkingIn, setCheckingIn] = useState(false);
  const [formError, setFormError] = useState("");
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [justAdded, setJustAdded] = useState("");

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const matchedRef = useRef<ScanItem | null>(null);
  const lookupBusyRef = useRef(false);
  const cooldownRef = useRef(0);
  const mountedRef = useRef(false);
  const cameraStartingRef = useRef(false);
  const checkingInRef = useRef(false);

  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Stop the active camera and release the scanner.
   * The scanner instance is detached before awaiting cleanup to prevent
   * duplicate stop operations.
   */
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    setCameraOn(false);
    setCameraStarting(false);
    cameraStartingRef.current = false;

    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn("Could not stop scanner cleanly:", error);
    }

    try {
      scanner.clear();
    } catch {
      // The reader may already have been cleared.
    }
  }, []);

  /**
   * Find a product using its product number or batch number.
   */
  const lookup = useCallback(async (raw: string) => {
    const code = raw.trim();

    if (!code) return;
    if (lookupBusyRef.current) return;
    if (Date.now() < cooldownRef.current) return;
    if (matchedRef.current) return;

    lookupBusyRef.current = true;

    setLooking(true);
    setFormError("");
    setNotFoundCode("");
    setExternal(null);
    setCodeInput("");

    try {
      const res = await apiFetch<{ items: ScanItem[] }>(
        `/api/store/items?lookup=${encodeURIComponent(code)}`,
        undefined,
        { toast: false },
      );

      const items = res.items ?? [];
      const upper = code.toUpperCase();

      const match =
        items.find(
          (item) =>
            (item.productNumber ?? "").toUpperCase() === upper,
        ) ??
        items.find(
          (item) =>
            (item.batchNumber ?? "").toUpperCase() === upper,
        ) ??
        null;

      cooldownRef.current = Date.now() + SCAN_COOLDOWN_MS;

      if (match) {
        matchedRef.current = match;
        setMatched(match);
        setNotFoundCode("");
        setQuantity("1");

        window.setTimeout(() => {
          if (mountedRef.current) {
            qtyInputRef.current?.focus();
          }
        }, 100);
      } else {
        // Not in this store's inventory — ask the external barcode
        // database so the add-product form can be prefilled with the
        // product's name, description, price, etc.
        setNotFoundCode(upper);
        setExternalLoading(true);

        try {
          const info = await apiFetch<ExternalProduct>(
            `/api/store/barcode-lookup?code=${encodeURIComponent(upper)}`,
            undefined,
            { toast: false },
          );

          if (mountedRef.current && info?.found) {
            setExternal(info);
          }
        } catch {
          // External lookup is best-effort — manual creation still works.
        } finally {
          if (mountedRef.current) {
            setExternalLoading(false);
          }
        }
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Lookup failed.",
      );
    } finally {
      lookupBusyRef.current = false;

      if (mountedRef.current) {
        setLooking(false);
      }
    }
  }, []);

  /**
   * Add stock for the selected product.
   */
  async function checkIn() {
    if (!matched || checkingInRef.current) return;

    const qty = Number(quantity);

    if (
      !Number.isSafeInteger(qty) ||
      qty < 1
    ) {
      setFormError("Enter a valid whole-number quantity of at least 1.");
      return;
    }

    checkingInRef.current = true;
    setCheckingIn(true);
    setFormError("");

    try {
      await apiFetch(`/api/store/items/${matched.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "in",
          quantity: qty,
        }),
      });

      const entry: SessionEntry = {
        key: `${matched.id}-${Date.now()}`,
        name: matched.name,
        qty,
        at: new Date().toLocaleTimeString(),
      };

      setSessionLog((previous) => [entry, ...previous].slice(0, 25));

      setJustAdded(
        `${qty} ${matched.unit || "unit"}${qty !== 1 ? "s" : ""} added to ${matched.name}`,
      );

      window.setTimeout(() => {
        if (mountedRef.current) {
          setJustAdded("");
        }
      }, 2500);

      matchedRef.current = null;
      setMatched(null);
      setNotFoundCode("");
      setQuantity("1");
      cooldownRef.current = Date.now() + SCAN_COOLDOWN_MS;

      onStocked();

      window.setTimeout(() => {
        if (mountedRef.current && !cameraOn) {
          codeInputRef.current?.focus();
        }
      }, 50);
    } catch {
      // apiFetch handles the request error notification.
    } finally {
      checkingInRef.current = false;

      if (mountedRef.current) {
        setCheckingIn(false);
      }
    }
  }

  /**
   * Start the camera.
   *
   * IMPORTANT: The reader element is always mounted in the JSX below.
   * Therefore, Html5Qrcode can find the element before start() is called.
   */
  async function startCamera() {
    if (cameraStartingRef.current || scannerRef.current) return;

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Camera access is unavailable. Use HTTPS or localhost, or enter the code manually.",
      );
      return;
    }

    cameraStartingRef.current = true;
    setCameraStarting(true);
    setCameraError("");
    setFormError("");

    let scanner: Html5Qrcode | null = null;

    try {
      // The reader div exists even before the camera is enabled.
      const readerElement = document.getElementById(READER_ID);

      if (!readerElement) {
        throw new Error(
          "Camera reader element is missing. Please close and reopen the scanner.",
        );
      }

      // Check permission/device availability before creating the scanner.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      stream.getTracks().forEach((track) => track.stop());

      // The modal might have been closed while permission was pending.
      if (!mountedRef.current) return;

      scanner = new Html5Qrcode(READER_ID, {
        verbose: false,
      });

      // Save the instance before starting so cleanup can access it.
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // Same scan-box approach as the working Security-tab scanner;
          // a wide box suits both QR codes and 1D barcodes. No aspectRatio
          // constraint — forcing one can break detection on laptop webcams.
          qrbox: (viewWidth: number, viewHeight: number) => {
            const width = Math.min(320, Math.max(150, Math.floor(viewWidth * 0.9)));
            const height = Math.min(220, Math.max(100, Math.floor(viewHeight * 0.5)));
            return { width, height };
          },
        },
        (decodedText) => {
          let code = decodedText.trim();

          // Support QR codes containing a URL as well as plain codes.
          try {
            const url = new URL(decodedText);
            const segments = url.pathname.split("/").filter(Boolean);

            code = segments[segments.length - 1] || decodedText;
          } catch {
            // The decoded text is a plain barcode/QR value.
          }

          if (
            !mountedRef.current ||
            lookupBusyRef.current ||
            matchedRef.current ||
            Date.now() < cooldownRef.current
          ) {
            return;
          }

          void lookup(code);
        },
        () => {
          // Individual frames without a QR match are normal.
        },
      );

      if (!mountedRef.current) {
        await stopCamera();
        return;
      }

      setCameraOn(true);
      codeInputRef.current?.blur();
    } catch (error) {
      console.error("Camera start failed:", error);

      if (scanner) {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch {
          // Scanner may never have started.
        }

        try {
          scanner.clear();
        } catch {
          // Reader may already have been cleared.
        }

        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }
      }

      if (mountedRef.current) {
        const message =
          error instanceof Error ? error.message : "";

        if (
          message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("notallowederror")
        ) {
          setCameraError(
            "Camera permission was denied. Allow camera access in your browser settings and try again.",
          );
        } else if (
          message.toLowerCase().includes("notfounderror") ||
          message.toLowerCase().includes("no camera")
        ) {
          setCameraError(
            "No available camera was found. You can still enter or scan a code manually.",
          );
        } else {
          setCameraError(
            "Could not start the camera. Check browser permissions and ensure no other tab is using the camera. Manual scanning is still available.",
          );
        }
      }
    } finally {
      cameraStartingRef.current = false;

      if (mountedRef.current) {
        setCameraStarting(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    codeInputRef.current?.focus();

    return () => {
      mountedRef.current = false;
      void stopCamera();
    };
  }, [stopCamera]);

  const totalUnits = sessionLog.reduce(
    (sum, entry) => sum + entry.qty,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="neu-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">
              <ScanLine size={18} className="text-emerald-600" />
              Scan &amp; add stock
            </h2>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Scan a barcode/QR or enter a product number, add the
              quantity, and repeat for bulk stock.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X size={17} />
          </button>
        </div>

        {/* Manual or hardware scanner input */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(codeInput);
          }}
          className="neu-inset mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5"
        >
          <Keyboard size={16} className="shrink-0 text-slate-400" />

          <input
            ref={codeInputRef}
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            placeholder="Scan or type product/batch number, then press Enter..."
            autoComplete="off"
            disabled={looking || checkingIn}
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-zinc-100"
          />

          {looking ? (
            <Loader2
              size={15}
              className="shrink-0 animate-spin text-slate-400"
            />
          ) : null}
        </form>

        {/* Camera controls */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (cameraOn) {
                void stopCamera();
              } else {
                void startCamera();
              }
            }}
            disabled={cameraStarting}
            className="neu-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {cameraStarting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : cameraOn ? (
              <CameraOff size={14} />
            ) : (
              <Camera size={14} />
            )}

            {cameraStarting
              ? "Starting camera..."
              : cameraOn
                ? "Stop camera"
                : "Start camera"}
          </button>

          {sessionLog.length > 0 ? (
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              {sessionLog.length} successful stock-in
              {sessionLog.length !== 1 ? "s" : ""} · {totalUnits}{" "}
              unit{totalUnits !== 1 ? "s" : ""} this session
            </span>
          ) : null}
        </div>

        {/* Camera error */}
        {cameraError ? (
          <div
            role="alert"
            className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {cameraError}
          </div>
        ) : null}

        {/* FIX: Keep the reader mounted at all times.
            Do not conditionally render the element passed to Html5Qrcode. */}
        <div
          className={`neu-inset mb-3 overflow-hidden rounded-xl p-2 ${
            cameraOn || cameraStarting ? "" : "hidden"
          }`}
        >
          <div id={READER_ID} className="min-h-[180px] w-full" />
        </div>

        {/* General errors */}
        {formError ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {formError}
          </p>
        ) : null}

        {/* Stock-in success */}
        {justAdded ? (
          <p
            role="status"
            className="mb-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <Check size={15} />
            {justAdded}
          </p>
        ) : null}

        {/* Matched product */}
        {matched ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-zinc-100">
                  {matched.name}
                </p>

                <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                  {matched.productNumber}
                  {matched.batchNumber
                    ? ` · Batch ${matched.batchNumber}`
                    : ""}
                </p>
              </div>

              <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                {categoryLabel(matched.category)}
              </span>
            </div>

            {matched.description ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                {matched.description}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-zinc-300">
              <span>
                Price:{" "}
                {Number(matched.price ?? 0) > 0
                  ? `₹${Number(matched.price).toFixed(2)}`
                  : "—"}
              </span>

              <span>
                Current stock: {matched.stock ?? 0}{" "}
                {matched.unit || "unit"}
              </span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void checkIn();
              }}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Quantity to add
                </span>

                <input
                  ref={qtyInputRef}
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={checkingIn}
                  className="neu-inset w-24 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none dark:text-zinc-100"
                />
              </label>

              <button
                type="submit"
                disabled={checkingIn || looking}
                className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {checkingIn ? (
                  <Loader2
                    className="animate-spin"
                    size={15}
                  />
                ) : (
                  <PackagePlus size={15} />
                )}

                {checkingIn ? "Adding..." : "Add stock"}
              </button>

              <button
                type="button"
                disabled={checkingIn}
                onClick={() => {
                  matchedRef.current = null;
                  setMatched(null);
                  setNotFoundCode("");
                  setQuantity("1");
                  setFormError("");
                  codeInputRef.current?.focus();
                }}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Skip
              </button>
            </form>
          </div>
        ) : null}

        {/* Unknown product */}
        {notFoundCode && !matched ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="break-words text-sm font-semibold text-slate-800 dark:text-zinc-100">
              Not in your inventory yet: “{notFoundCode}”.
            </p>

            {externalLoading ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                Looking up this barcode in the product database…
              </p>
            ) : external ? (
              <div className="mt-2 flex gap-3">
                {external.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={external.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-amber-200 bg-white object-contain p-1 dark:border-amber-900/50"
                  />
                ) : null}

                <div className="min-w-0 text-xs text-slate-600 dark:text-zinc-300">
                  <p className="truncate font-semibold text-slate-800 dark:text-zinc-100">
                    {external.name}
                  </p>

                  {external.brand ? (
                    <p className="text-slate-500 dark:text-zinc-400">
                      Brand: {external.brand}
                    </p>
                  ) : null}

                  {external.price != null ? (
                    <p>
                      Price: {external.currency || "₹"}
                      {external.price.toFixed(2)}
                    </p>
                  ) : null}

                  {external.description ? (
                    <p className="mt-1 line-clamp-3 text-slate-500 dark:text-zinc-400">
                      {external.description}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                No details found online either. Create it manually with
                this code prefilled as its product number.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  onUnknownCode(notFoundCode, {
                    name: external?.name ?? "",
                    description: external?.description ?? "",
                    price:
                      external?.price != null
                        ? String(external.price)
                        : "",
                    category: external?.category ?? "",
                  })
                }
                className="neu-btn neu-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
              >
                <PackagePlus size={15} />
                {external
                  ? "Create product with these details"
                  : "Create new product"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setNotFoundCode("");
                  setExternal(null);
                  setFormError("");
                  codeInputRef.current?.focus();
                }}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {/* Session log */}
        {sessionLog.length > 0 ? (
          <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Added this session
              </p>

              <span className="text-xs text-slate-400">
                {totalUnits} total units
              </span>
            </div>

            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {sessionLog.map((entry) => (
                <li
                  key={entry.key}
                  className="flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-zinc-300"
                >
                  <span className="truncate">{entry.name}</span>

                  <span className="shrink-0 text-xs text-slate-400">
                    +{entry.qty} · {entry.at}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-zinc-800">
            Nothing stocked in yet. Start the camera or use a
            barcode scanner on the input above.
          </p>
        )}
      </div>
    </div>
  );
}
