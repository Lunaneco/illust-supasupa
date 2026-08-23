export type FrameKind = "none" | "slice" | "draw";

export type FrameId =
  | "none"
  | "wood"
  | "magazine"
  | "gothic"
  | "gold"
  | "washi"
  | "brass";

export type FrameDef = {
  id: FrameId;
  label: string;
  hint: string;
  kind: FrameKind;
  src?: string;
  /** 9-slice inset in source pixels (1024 canvas). */
  slice?: number;
  draw?: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    weight: number,
  ) => void;
};

export const FRAMES: FrameDef[] = [
  { id: "none", label: "なし", hint: "そのまま", kind: "none" },
  {
    id: "wood",
    label: "木枠",
    hint: "高級なウォールナット",
    kind: "slice",
    src: "/frames/wood.png?v=3",
    slice: 105,
  },
  {
    id: "magazine",
    label: "雑誌",
    hint: "二重線",
    kind: "draw",
    draw: drawMagazine,
  },
  {
    id: "gothic",
    label: "ゴシック",
    hint: "植物と鉄",
    kind: "slice",
    src: "/frames/gothic.png?v=2",
    slice: 107,
  },
  {
    id: "gold",
    label: "金縁",
    hint: "ギャラリー",
    kind: "slice",
    src: "/frames/gold.png?v=2",
    slice: 111,
  },
  {
    id: "washi",
    label: "和紙",
    hint: "墨の縁",
    kind: "slice",
    src: "/frames/washi.png?v=2",
    slice: 85,
  },
  {
    id: "brass",
    label: "細金",
    hint: "細い線",
    kind: "draw",
    draw: drawBrass,
  },
];

const FRAME_SIZE = 1024;
const imageCache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

export function frameById(id: FrameId): FrameDef {
  return FRAMES.find((frame) => frame.id === id) ?? FRAMES[0]!;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = loading.get(src);
  if (pending) return pending;
  const task = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imageCache.set(src, img);
      loading.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      loading.delete(src);
      reject(new Error("枠画像を読み込めませんでした"));
    };
    img.src = src;
  });
  loading.set(src, task);
  return task;
}

export function preloadFrames() {
  for (const frame of FRAMES) {
    if (frame.src) void loadImage(frame.src);
  }
}

export const FRAME_WEIGHT_MIN = 0.5;
export const FRAME_WEIGHT_MAX = 1.6;
export const FRAME_WEIGHT_DEFAULT = 1;

export async function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: FrameDef,
  weight = FRAME_WEIGHT_DEFAULT,
) {
  if (frame.kind === "none") return;
  const w = Math.min(FRAME_WEIGHT_MAX, Math.max(FRAME_WEIGHT_MIN, weight));
  if (frame.kind === "draw" && frame.draw) {
    frame.draw(ctx, width, height, w);
    return;
  }
  if (frame.kind === "slice" && frame.src && frame.slice) {
    const img = await loadImage(frame.src);
    drawNineSlice(ctx, img, FRAME_SIZE, FRAME_SIZE, frame.slice, width, height, w);
  }
}

function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  srcW: number,
  srcH: number,
  slice: number,
  destW: number,
  destH: number,
  weight: number,
) {
  const src = Math.max(1, Math.round(slice));
  const ratio = (src / Math.min(srcW, srcH)) * weight;
  const margin = Math.min(
    Math.max(2, Math.round(Math.min(destW, destH) * ratio)),
    Math.floor(Math.min(destW, destH) * 0.42),
  );
  const sx = [0, src, srcW - src, srcW];
  const sy = [0, src, srcH - src, srcH];
  const dx = [0, margin, destW - margin, destW];
  const dy = [0, margin, destH - margin, destH];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      const sw = sx[col + 1]! - sx[col]!;
      const sh = sy[row + 1]! - sy[row]!;
      const tw = dx[col + 1]! - dx[col]!;
      const th = dy[row + 1]! - dy[row]!;
      if (sw < 1 || sh < 1 || tw < 1 || th < 1) continue;
      ctx.drawImage(img, sx[col]!, sy[row]!, sw, sh, dx[col]!, dy[row]!, tw, th);
    }
  }
  ctx.restore();
}

function drawMagazine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weight: number,
) {
  const min = Math.min(width, height);
  const line = Math.max(1, Math.round(min * 0.0045 * weight));
  const gap = Math.max(3, Math.round(min * 0.018 * weight));
  ctx.save();
  ctx.strokeStyle = "#2b2722";
  ctx.lineWidth = line;
  ctx.strokeRect(line / 2, line / 2, width - line, height - line);
  ctx.lineWidth = Math.max(1, Math.round(line * 0.7));
  ctx.strokeRect(gap + line / 2, gap + line / 2, width - 2 * gap - line, height - 2 * gap - line);
  ctx.restore();
}

function drawBrass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weight: number,
) {
  const min = Math.min(width, height);
  const line = Math.max(1, Math.round(min * 0.007 * weight));
  const tick = Math.max(5, Math.round(min * 0.03 * weight));
  ctx.save();
  ctx.strokeStyle = "#b08d57";
  ctx.lineWidth = line;
  ctx.strokeRect(line / 2, line / 2, width - line, height - line);
  ctx.lineWidth = Math.max(1, line - 1);
  const inner = Math.max(line + 2, Math.round(min * 0.016 * weight));
  ctx.strokeRect(inner + 0.5, inner + 0.5, width - 2 * inner - 1, height - 2 * inner - 1);
  ctx.lineWidth = line;
  const inset = line / 2;
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [width - inset, inset, -1, 1],
    [inset, height - inset, 1, -1],
    [width - inset, height - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * tick);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * tick, y);
    ctx.stroke();
  }
  ctx.restore();
}
