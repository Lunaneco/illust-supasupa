export type Tile = {
  row: number;
  col: number;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Inclusive start positions plus a final end bound.
 * Every pixel in [0, total) belongs to exactly one slice — no gaps, no overlap.
 */
export function sliceBounds(total: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  const size = Math.max(0, Math.floor(total));
  const bounds: number[] = [];
  for (let i = 0; i <= n; i++) {
    bounds.push(Math.round((i * size) / n));
  }
  return bounds;
}

export function buildTiles(
  imageWidth: number,
  imageHeight: number,
  cols: number,
  rows: number,
): Tile[] {
  const xs = sliceBounds(imageWidth, cols);
  const ys = sliceBounds(imageHeight, rows);
  const colCount = xs.length - 1;
  const rowCount = ys.length - 1;
  const tiles: Tile[] = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const x = xs[c] ?? 0;
      const y = ys[r] ?? 0;
      const nextX = xs[c + 1] ?? x;
      const nextY = ys[r + 1] ?? y;
      tiles.push({
        row: r,
        col: c,
        index: r * colCount + c,
        x,
        y,
        width: nextX - x,
        height: nextY - y,
      });
    }
  }
  return tiles;
}

export function axisRange(
  tiles: Tile[],
  axis: "width" | "height",
): { min: number; max: number } {
  if (tiles.length === 0) return { min: 0, max: 0 };
  let min = tiles[0]![axis];
  let max = min;
  for (const tile of tiles) {
    min = Math.min(min, tile[axis]);
    max = Math.max(max, tile[axis]);
  }
  return { min, max };
}

export function formatPxRange(range: { min: number; max: number }): string {
  if (range.min === range.max) return `${range.min}`;
  return `${range.min}–${range.max}`;
}

export function stemFromFilename(name: string): string {
  const trimmed = name.trim();
  const withoutExt = trimmed.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]+/g, "_");
  return cleaned.replace(/^_+|_+$/g, "") || "supasupa";
}

export function tileFilename(
  stem: string,
  tile: Tile,
  rows: number,
  cols: number,
  ext: string,
): string {
  const rowPad = String(rows).length;
  const colPad = String(cols).length;
  const r = String(tile.row + 1).padStart(rowPad, "0");
  const c = String(tile.col + 1).padStart(colPad, "0");
  return `${stem}_r${r}_c${c}.${ext}`;
}

export function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export const MAX_GRID = 16;
export const MIN_GRID = 1;
