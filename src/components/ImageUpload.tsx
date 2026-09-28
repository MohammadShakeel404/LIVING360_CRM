"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";

/** Reads an image file, downsizes it on a canvas and returns a PNG/JPEG data URL. */
async function toDataUrl(file: File, maxWidth: number): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't a readable image."));
      i.src = src;
    });
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    const keepAlpha = file.type === "image/png" || file.type === "image/svg+xml" || file.type === "image/webp";
    if (!keepAlpha) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function ImageUpload({
  label, hint, value, onChange, maxWidth = 800, previewClass = "h-20", disabled,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  maxWidth?: number;
  previewClass?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const url = await toDataUrl(file, maxWidth);
      if (url.length > 2_900_000) throw new Error("Image is still too large after resizing — try a smaller file.");
      onChange(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!disabled) pick(e.dataTransfer.files[0]); }}
        className="flex items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-line bg-appbg p-3"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className={`${previewClass} max-w-[60%] rounded-md bg-white object-contain p-1 ring-1 ring-line`} />
        ) : (
          <div className={`${previewClass} flex aspect-[3/1] items-center justify-center rounded-md bg-white text-ink-faint ring-1 ring-line`}>
            <ImagePlus size={20} />
          </div>
        )}
        {!disabled && (
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-primary ring-1 ring-line hover:ring-primary/40">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {value ? "Replace" : "Upload"}
            </button>
            {value && (
              <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-danger hover:bg-danger-bg">
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        )}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {hint && <span className="text-[11.5px] text-ink-faint">{hint}</span>}
      {error && <span className="text-[12px] font-medium text-danger">{error}</span>}
    </div>
  );
}
