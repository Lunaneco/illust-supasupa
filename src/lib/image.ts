import type { Tile } from "./split";
import type { CropRect } from "./crop";
import { drawFrame, type FrameDef } from "./frames";

export type LoadedImage = {
  name: string;
  width: number;
  height: number;
  previewUrl: string;
  bitmap: ImageBitmap;
};

export async function loadImageSource(
  source: Blob,
  name: string,
): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(source, {
    imageOrientation: "from-image",
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const previewUrl = await bitmapToJpegUrl(bitmap);
  return {
    name,
    width: bitmap.width,
    height: bitmap.height,
    previewUrl,
    bitmap,
  };
}

export function disposeImage(image: LoadedImage | null) {
  if (!image) return;
  URL.revokeObjectURL(image.previewUrl);
  image.bitmap.close();
}

async function bitmapToJpegUrl(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("プレビュー用キャンバスを作成できませんでした");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  return URL.createObjectURL(blob);
}

function canvas2d(
  canvas: HTMLCanvasElement,
  alpha: boolean,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { alpha });
  if (!ctx) throw new Error("キャンバスを作成できませんでした");
  return ctx;
}

/** Duplicate edge pixels so bilinear scaling never samples transparent/empty. */
function padSource(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  pad: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = sw + pad * 2;
  canvas.height = sh + pad * 2;
  const ctx = canvas2d(canvas, true);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, sx, sy, sw, sh, pad, pad, sw, sh);
  ctx.drawImage(source, sx, sy, sw, 1, pad, 0, sw, pad);
  ctx.drawImage(source, sx, sy + sh - 1, sw, 1, pad, pad + sh, sw, pad);
  ctx.drawImage(source, sx, sy, 1, sh, 0, pad, pad, sh);
  ctx.drawImage(source, sx + sw - 1, sy, 1, sh, pad + sw, pad, pad, sh);
  ctx.drawImage(source, sx, sy, 1, 1, 0, 0, pad, pad);
  ctx.drawImage(source, sx + sw - 1, sy, 1, 1, pad + sw, 0, pad, pad);
  ctx.drawImage(source, sx, sy + sh - 1, 1, 1, 0, pad + sh, pad, pad);
  ctx.drawImage(source, sx + sw - 1, sy + sh - 1, 1, 1, pad + sw, pad + sh, pad, pad);
  return canvas;
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
) {
  const x = Math.round(sx);
  const y = Math.round(sy);
  const w = Math.max(1, Math.round(sw));
  const h = Math.max(1, Math.round(sh));
  if (dw === w && dh === h) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, x, y, w, h, 0, 0, dw, dh);
    return;
  }
  const pad = 2;
  const padded = padSource(source, x, y, w, h, pad);
  const scaleX = dw / w;
  const scaleY = dh / h;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    padded,
    0,
    0,
    padded.width,
    padded.height,
    -pad * scaleX,
    -pad * scaleY,
    padded.width * scaleX,
    padded.height * scaleY,
  );}

export function cropAndScale(
  bitmap: ImageBitmap,
  crop: CropRect,
  width: number,
  height: number,
): CanvasImageSource {
  const destW = Math.max(1, Math.round(width));
  const destH = Math.max(1, Math.round(height));
  const full =
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === bitmap.width &&
    crop.height === bitmap.height;
  if (full && bitmap.width === destW && bitmap.height === destH) {
    return bitmap;
  }
  const canvas = document.createElement("canvas");
  canvas.width = destW;
  canvas.height = destH;
  const ctx = canvas2d(canvas, true);
  drawRect(ctx, bitmap, crop.x, crop.y, crop.width, crop.height, destW, destH);
  return canvas;
}

export async function applyFrameToImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  frame?: FrameDef | null,
  weight = 1,
): Promise<CanvasImageSource> {
  if (!frame || frame.kind === "none") return source;
  const destW = Math.max(1, Math.round(width));
  const destH = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = destW;
  canvas.height = destH;
  const ctx = canvas2d(canvas, true);
  ctx.drawImage(source, 0, 0, destW, destH);
  await drawFrame(ctx, destW, destH, frame, weight);
  return canvas;
}

export async function rasterizeTile(
  source: CanvasImageSource,
  tile: Tile,
  mime: string,
  quality: number,
): Promise<Blob> {
  const width = Math.max(1, Math.round(tile.width));
  const height = Math.max(1, Math.round(tile.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas2d(canvas, mime !== "image/jpeg");
  drawRect(ctx, source, tile.x, tile.y, tile.width, tile.height, width, height);
  return canvasToBlob(
    canvas,
    mime,
    mime === "image/png" ? undefined : quality,
  );
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("画像の書き出しに失敗しました"));
      },
      mime,
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function asFile(blob: Blob, filename: string, mime: string): File {
  return new File([blob], filename, { type: mime || blob.type });
}

async function shareFiles(files: File[]): Promise<"shared" | "aborted" | "unsupported"> {
  if (files.length === 0) return "unsupported";
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return "unsupported";
  }
  try {
    if (!navigator.canShare({ files })) return "unsupported";
    await navigator.share({ files });
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "aborted";
    return "unsupported";
  }
}

export async function saveImages(
  items: { blob: Blob; filename: string }[],
  mime: string,
): Promise<"shared" | "downloaded" | "aborted"> {
  if (items.length === 0) return "downloaded";
  if (mime === "image/jpeg" && isAppleTouchDevice()) {
    const files = items.map((item) =>
      asFile(item.blob, item.filename.replace(/\.jpe?g$/i, ".jpg"), "image/jpeg"),
    );
    const result = await shareFiles(files);
    if (result === "shared" || result === "aborted") return result;
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    downloadBlob(item.blob, item.filename);
    if (i < items.length - 1) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 140);
      });
    }
  }
  return "downloaded";
}

export async function copyPng(blob: Blob) {
  const png =
    blob.type === "image/png"
      ? blob
      : await convertBlob(blob, "image/png");
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": png }),
  ]);
}

async function convertBlob(blob: Blob, mime: string): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas2d(canvas, mime !== "image/jpeg");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToBlob(canvas, mime);
}
