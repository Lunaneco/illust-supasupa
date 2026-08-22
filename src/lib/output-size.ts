export const MIN_EDGE = 16;
export const MAX_EDGE = 8192;

export type OutputSize = {
  width: number;
  height: number;
};

export function originalSize(srcW: number, srcH: number): OutputSize {
  return {
    width: Math.max(1, Math.round(srcW)),
    height: Math.max(1, Math.round(srcH)),
  };
}

export function sizeFromWidth(
  srcW: number,
  srcH: number,
  width: number,
): OutputSize {
  const w = clampEdge(width);
  const h = clampEdge((w * srcH) / srcW);
  return { width: w, height: h };
}

export function sizeFromHeight(
  srcW: number,
  srcH: number,
  height: number,
): OutputSize {
  const h = clampEdge(height);
  const w = clampEdge((h * srcW) / srcH);
  return { width: w, height: h };
}

export function sizeFromPercent(
  srcW: number,
  srcH: number,
  percent: number,
): OutputSize {
  const p = Math.min(200, Math.max(10, percent));
  return sizeFromWidth(srcW, srcH, (srcW * p) / 100);
}

export function sizeFromLongEdge(
  srcW: number,
  srcH: number,
  long: number,
): OutputSize {
  if (srcW >= srcH) return sizeFromWidth(srcW, srcH, long);
  return sizeFromHeight(srcW, srcH, long);
}

export function percentOf(srcW: number, outW: number): number {
  if (srcW <= 0) return 100;
  return (outW / srcW) * 100;
}

export function isOriginal(
  srcW: number,
  srcH: number,
  out: OutputSize,
): boolean {
  return out.width === srcW && out.height === srcH;
}

function clampEdge(value: number): number {
  if (!Number.isFinite(value)) return MIN_EDGE;
  return Math.min(MAX_EDGE, Math.max(MIN_EDGE, Math.round(value)));
}
