export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type AspectLock = { w: number; h: number } | null;

export function fullFrame(imageWidth: number, imageHeight: number): CropRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(imageWidth)),
    height: Math.max(1, Math.round(imageHeight)),
  };
}

export function clampCrop(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
  minWidth = 16,
  minHeight = 16,
): CropRect {
  const maxW = Math.max(1, Math.round(imageWidth));
  const maxH = Math.max(1, Math.round(imageHeight));
  const minW = Math.min(maxW, Math.max(1, Math.round(minWidth)));
  const minH = Math.min(maxH, Math.max(1, Math.round(minHeight)));
  const width = Math.min(maxW, Math.max(minW, Math.round(crop.width)));
  const height = Math.min(maxH, Math.max(minH, Math.round(crop.height)));
  const x = Math.min(maxW - width, Math.max(0, Math.round(crop.x)));
  const y = Math.min(maxH - height, Math.max(0, Math.round(crop.y)));
  return { x, y, width, height };
}

export function moveCrop(
  start: CropRect,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
): CropRect {
  return clampCrop(
    {
      ...start,
      x: start.x + dx,
      y: start.y + dy,
    },
    imageWidth,
    imageHeight,
    start.width,
    start.height,
  );
}

export function locksEqual(a: AspectLock, b: AspectLock): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.w * b.h === a.h * b.w;
}

export function sizeForAspect(
  lock: { w: number; h: number },
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
  prefer: "width" | "height",
): { width: number; height: number } {
  const maxW = Math.max(1, Math.round(imageWidth));
  const maxH = Math.max(1, Math.round(imageHeight));
  const minW = 16;
  const minH = 16;
  let w: number;
  let h: number;
  if (prefer === "width") {
    w = Math.round(width);
    h = Math.round((w * lock.h) / lock.w);
  } else {
    h = Math.round(height);
    w = Math.round((h * lock.w) / lock.h);
  }
  if (w > maxW) {
    w = maxW;
    h = Math.round((w * lock.h) / lock.w);
  }
  if (h > maxH) {
    h = maxH;
    w = Math.round((h * lock.w) / lock.h);
  }
  if (w < minW) {
    w = minW;
    h = Math.round((w * lock.h) / lock.w);
  }
  if (h < minH) {
    h = minH;
    w = Math.round((h * lock.w) / lock.h);
  }
  w = Math.min(maxW, Math.max(1, w));
  h = Math.min(maxH, Math.max(1, h));
  return { width: w, height: h };
}

export function resizeCrop(
  start: CropRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
  aspect: AspectLock = null,
): CropRect {
  if (aspect && aspect.w > 0 && aspect.h > 0) {
    return resizeCropLocked(
      start,
      handle,
      dx,
      dy,
      imageWidth,
      imageHeight,
      aspect,
    );
  }
  let { x, y, width, height } = start;
  const right = x + width;
  const bottom = y + height;
  if (handle.includes("w")) {
    const nextX = Math.min(right - 16, Math.max(0, x + dx));
    width = right - nextX;
    x = nextX;
  }
  if (handle.includes("e")) {
    width = Math.min(imageWidth - x, Math.max(16, width + dx));
  }
  if (handle.includes("n")) {
    const nextY = Math.min(bottom - 16, Math.max(0, y + dy));
    height = bottom - nextY;
    y = nextY;
  }
  if (handle.includes("s")) {
    height = Math.min(imageHeight - y, Math.max(16, height + dy));
  }
  return clampCrop({ x, y, width, height }, imageWidth, imageHeight);
}

function resizeCropLocked(
  start: CropRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
  lock: { w: number; h: number },
): CropRect {
  let width = start.width;
  let height = start.height;
  if (handle.includes("e")) width = start.width + dx;
  if (handle.includes("w")) width = start.width - dx;
  if (handle.includes("s")) height = start.height + dy;
  if (handle.includes("n")) height = start.height - dy;

  const corner = handle.length === 2;
  const prefer: "width" | "height" = corner
    ? Math.abs(width - start.width) * lock.h >= Math.abs(height - start.height) * lock.w
      ? "width"
      : "height"
    : handle === "n" || handle === "s"
      ? "height"
      : "width";

  const size = sizeForAspect(lock, width, height, imageWidth, imageHeight, prefer);
  width = size.width;
  height = size.height;

  let x = start.x;
  let y = start.y;
  if (handle.includes("w")) x = start.x + start.width - width;
  if (handle.includes("n")) y = start.y + start.height - height;
  if (handle === "e" || handle === "w") {
    y = start.y + (start.height - height) / 2;
  }
  if (handle === "n" || handle === "s") {
    x = start.x + (start.width - width) / 2;
  }
  return clampCrop({ x, y, width, height }, imageWidth, imageHeight, width, height);
}

export function setCropSize(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
  aspect: AspectLock = null,
  prefer: "width" | "height" = "width",
): CropRect {
  const size = aspect
    ? sizeForAspect(aspect, width, height, imageWidth, imageHeight, prefer)
    : { width, height };
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return clampCrop(
    {
      x: cx - size.width / 2,
      y: cy - size.height / 2,
      width: size.width,
      height: size.height,
    },
    imageWidth,
    imageHeight,
    aspect ? size.width : 16,
    aspect ? size.height : 16,
  );
}

export function fitAspectCrop(
  imageWidth: number,
  imageHeight: number,
  ratioW: number,
  ratioH: number,
  around?: CropRect,
): CropRect {
  const size = sizeForAspect(
    { w: ratioW, h: ratioH },
    imageWidth,
    imageHeight,
    imageWidth,
    imageHeight,
    imageWidth / imageHeight >= ratioW / ratioH ? "height" : "width",
  );
  const cx = around ? around.x + around.width / 2 : imageWidth / 2;
  const cy = around ? around.y + around.height / 2 : imageHeight / 2;
  return clampCrop(
    {
      x: cx - size.width / 2,
      y: cy - size.height / 2,
      width: size.width,
      height: size.height,
    },
    imageWidth,
    imageHeight,
    size.width,
    size.height,
  );
}

export function isFullFrame(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
): boolean {
  return (
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === imageWidth &&
    crop.height === imageHeight
  );
}
