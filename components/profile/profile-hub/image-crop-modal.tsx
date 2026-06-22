import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: { width: number; height: number },
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement("canvas");
      canvas.width = outputSize.width;
      canvas.height = outputSize.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputSize.width,
        outputSize.height,
      );
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/png",
        1,
      );
    } catch (err) {
      reject(err);
    }
  });
}

export function ImageCropModal({
  file,
  onCancel,
  onDone,
  aspect = 1,
}: {
  file: File;
  onCancel: () => void;
  onDone: (croppedBlob: Blob) => void;
  aspect?: number;
}) {
  const imageSrc = URL.createObjectURL(file);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  const onCropComplete = useCallback(
    (_: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  async function handleDone() {
    if (!croppedAreaPixels) return;
    setCropping(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, {
        width: 512,
        height: Math.round(512 / aspect),
      });
      onDone(blob);
    } catch {
      setCropping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h4 className="text-lg font-semibold text-slate-900">Crop Image</h4>
        </div>
        <div className="relative h-80 w-full bg-slate-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-3">
          <span className="text-xs text-slate-500">Zoom</span>
          <input
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-950"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={cropping || !croppedAreaPixels}
            onClick={handleDone}
            type="button"
          >
            {cropping ? "Processing..." : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
