import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Download,
  ImagePlus,
  Minus,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Decor } from "@/components/decor";
import { CropStage } from "@/components/splitter/crop-stage";
import { FrameThumb, CroppedFrameOverlay } from "@/components/splitter/frame-overlay";
import { TileBoard, tileSpriteStyle } from "@/components/splitter/tile-board";
import { cn } from "@/lib/utils";
import {
  axisRange,
  buildTiles,
  extForMime,
  formatPxRange,
  MAX_GRID,
  MIN_GRID,
  stemFromFilename,
  tileFilename,
  type Tile,
} from "@/lib/split";
import {
  copyPng,
  cropAndScale,
  applyFrameToImage,
  disposeImage,
  isAppleTouchDevice,
  loadImageSource,
  rasterizeTile,
  saveImages,
  type LoadedImage,
} from "@/lib/image";
import {
  fitAspectCrop,
  fullFrame,
  isFullFrame,
  locksEqual,
  setCropSize,
  type AspectLock,
  type CropRect,
} from "@/lib/crop";
import {
  FRAMES,
  FRAME_WEIGHT_DEFAULT,
  FRAME_WEIGHT_MAX,
  FRAME_WEIGHT_MIN,
  frameById,
  preloadFrames,
  type FrameDef,
  type FrameId,
} from "@/lib/frames";
import {
  isOriginal,
  originalSize,
  percentOf,
  sizeFromHeight,
  sizeFromLongEdge,
  sizeFromPercent,
  sizeFromWidth,
  type OutputSize,
} from "@/lib/output-size";

export const Route = createFileRoute("/")({ component: Home });

type Mime = "image/png" | "image/jpeg" | "image/webp";

const PRESETS: { cols: number; rows: number; label: string }[] = [
  { cols: 2, rows: 2, label: "2×2" },
  { cols: 3, rows: 3, label: "3×3" },
  { cols: 4, rows: 4, label: "4×4" },
  { cols: 2, rows: 3, label: "2×3" },
  { cols: 3, rows: 2, label: "3×2" },
  { cols: 1, rows: 2, label: "上下" },
  { cols: 2, rows: 1, label: "左右" },
  { cols: 3, rows: 1, label: "三連" },
  { cols: 4, rows: 5, label: "4×5" },
];

const SIZE_PRESETS: { label: string; apply: (w: number, h: number) => OutputSize }[] = [
  { label: "原寸", apply: (w, h) => originalSize(w, h) },
  { label: "75%", apply: (w, h) => sizeFromPercent(w, h, 75) },
  { label: "50%", apply: (w, h) => sizeFromPercent(w, h, 50) },
  { label: "長辺2048", apply: (w, h) => sizeFromLongEdge(w, h, 2048) },
  { label: "長辺1280", apply: (w, h) => sizeFromLongEdge(w, h, 1280) },
  { label: "長辺1080", apply: (w, h) => sizeFromLongEdge(w, h, 1080) },
];

const RATIO_PRESETS: { label: string; lock: AspectLock }[] = [
  { label: "自由", lock: null },
  { label: "1:1", lock: { w: 1, h: 1 } },
  { label: "16:9", lock: { w: 16, h: 9 } },
  { label: "4:3", lock: { w: 4, h: 3 } },
  { label: "3:4", lock: { w: 3, h: 4 } },
  { label: "3:2", lock: { w: 3, h: 2 } },
  { label: "2:3", lock: { w: 2, h: 3 } },
];

const SAMPLES = [
  { src: "/sample-still.jpg", name: "sample-still.jpg", label: "静物" },
  { src: "/sample-garden.jpg", name: "sample-garden.jpg", label: "縁側" },
];

function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<LoadedImage | null>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [mime, setMime] = useState<Mime>("image/jpeg");
  const [quality, setQuality] = useState(0.92);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [out, setOut] = useState<OutputSize>({ width: 1, height: 1 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [aspect, setAspect] = useState<AspectLock>(null);
  const [saveToPhotos, setSaveToPhotos] = useState(false);
  const [frameId, setFrameId] = useState<FrameId>("none");
  const [frameWeight, setFrameWeight] = useState(FRAME_WEIGHT_DEFAULT);
  const frame = frameById(frameId);

  const maxCols = image ? Math.min(MAX_GRID, out.width, crop.width) : MAX_GRID;
  const maxRows = image ? Math.min(MAX_GRID, out.height, crop.height) : MAX_GRID;

  const previewTiles = useMemo(() => {
    if (!image) return [];
    return buildTiles(crop.width, crop.height, cols, rows).map((tile) => ({
      ...tile,
      x: crop.x + tile.x,
      y: crop.y + tile.y,
    }));
  }, [image, crop, cols, rows]);

  const tiles = useMemo(() => {
    if (!image) return [];
    return buildTiles(out.width, out.height, cols, rows);
  }, [image, out.width, out.height, cols, rows]);

  const widthRange = useMemo(() => axisRange(tiles, "width"), [tiles]);
  const heightRange = useMemo(() => axisRange(tiles, "height"), [tiles]);
  const activePreview =
    activeIndex == null ? null : (previewTiles[activeIndex] ?? null);
  const activeExport =
    activeIndex == null ? null : (tiles[activeIndex] ?? null);

  const applyOut = (next: OutputSize) => {
    setOut(next);
    setCols((c) => Math.min(c, Math.min(MAX_GRID, next.width)));
    setRows((r) => Math.min(r, Math.min(MAX_GRID, next.height)));
  };

  const applyCrop = (next: CropRect) => {
    const sizeChanged = next.width !== crop.width || next.height !== crop.height;
    setCrop(next);
    if (!sizeChanged) return;
    if (isOriginal(crop.width, crop.height, out)) {
      applyOut(originalSize(next.width, next.height));
    } else {
      const pct = percentOf(crop.width, out.width);
      applyOut(sizeFromPercent(next.width, next.height, pct));
    }
  };

  const applyAspect = (lock: AspectLock) => {
    setAspect(lock);
    if (!image) return;
    if (!lock) return;
    applyCrop(fitAspectCrop(image.width, image.height, lock.w, lock.h, crop));
  };

  const replaceImage = useCallback((next: LoadedImage) => {
    disposeImage(imageRef.current);
    imageRef.current = next;
    setImage(next);
    setActiveIndex(null);
    const frame = fullFrame(next.width, next.height);
    setCrop(frame);
    setAspect(null);
    setOut(originalSize(next.width, next.height));
    setCols((c) => Math.min(c, Math.min(MAX_GRID, next.width)));
    setRows((r) => Math.min(r, Math.min(MAX_GRID, next.height)));
  }, []);

  useEffect(() => {
    return () => disposeImage(imageRef.current);
  }, []);

  useEffect(() => {
    setSaveToPhotos(isAppleTouchDevice());
    preloadFrames();
  }, []);

  const ingestFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("画像ファイルを選んでください");
        return;
      }
      try {
        setBusy("読み込み中…");
        const loaded = await loadImageSource(file, file.name);
        replaceImage(loaded);
      } catch (err) {
        console.error(err);
        toast.error("画像を読み込めませんでした");
      } finally {
        setBusy(null);
      }
    },
    [replaceImage],
  );

  const ingestFiles = useCallback(
    (files: FileList | File[] | null) => {
      const file = files && files[0];
      if (file) void ingestFile(file);
    },
    [ingestFile],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void ingestFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestFile]);

  const loadSample = async (src: string, name: string) => {
    try {
      setBusy("読み込み中…");
      const res = await fetch(src);
      const blob = await res.blob();
      const loaded = await loadImageSource(blob, name);
      replaceImage(loaded);
    } catch (err) {
      console.error(err);
      toast.error("サンプルを読み込めませんでした");
    } finally {
      setBusy(null);
    }
  };

  const stem = image ? stemFromFilename(image.name) : "supasupa";
  const ext = extForMime(mime);
  const native = image ? isOriginal(crop.width, crop.height, out) : true;
  const scalePct = image ? percentOf(crop.width, out.width) : 100;

  const jpegToPhotos = mime === "image/jpeg" && saveToPhotos;

  const sourceForExport = async () => {
    if (!image) throw new Error("画像がありません");
    const scaled = cropAndScale(image.bitmap, crop, out.width, out.height);
    return applyFrameToImage(scaled, out.width, out.height, frame, frameWeight);
  };

  const exportTile = async (tile: Tile) => {
    if (!image) return;
    try {
      const blob = await rasterizeTile(await sourceForExport(), tile, mime, quality);
      const result = await saveImages(
        [{ blob, filename: tileFilename(stem, tile, rows, cols, ext) }],
        mime,
      );
      if (result === "aborted") return;
      if (result === "downloaded") toast.success("保存しました");
    } catch (err) {
      console.error(err);
      toast.error("保存に失敗しました");
    }
  };

  const exportAll = async () => {
    if (!image || tiles.length === 0) return;
    try {
      setBusy(`保存中 0 / ${tiles.length}`);
      const source = await sourceForExport();
      const items: { blob: Blob; filename: string }[] = [];
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]!;
        const blob = await rasterizeTile(source, tile, mime, quality);
        items.push({ blob, filename: tileFilename(stem, tile, rows, cols, ext) });
        setBusy(`保存中 ${i + 1} / ${tiles.length}`);
        await yieldFrame();
      }
      const result = await saveImages(items, mime);
      if (result === "aborted") return;
      if (result === "downloaded") {
        toast.success(`${tiles.length}枚を保存しました`);
      }
    } catch (err) {
      console.error(err);
      toast.error("保存に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const copyActive = async () => {
    if (!image || !activeExport) return;
    try {
      const blob = await rasterizeTile(await sourceForExport(), activeExport, "image/png", 1);
      await copyPng(blob);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("クリップボードにコピーしました");
    } catch (err) {
      console.error(err);
      toast.error("コピーできませんでした");
    }
  };

  return (
    <main className="page-shell relative z-10 mx-auto min-h-dvh max-w-6xl px-4 md:px-8">
      <Decor />
      <header className="flex items-end justify-between gap-4 pb-6">
        <div className="enter-item">
          <h1 className="font-display text-3xl tracking-display text-fg md:text-5xl">
            イラストすぱすぱ
          </h1>
          <p className="mt-2 text-sm text-muted">使うところを決めて、すぱっと切る</p>
        </div>
        {image ? (
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="shrink-0"
          >
            <Upload className="size-4" />
            別の画像
          </Button>
        ) : null}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        className="sr-only"
        onChange={(event) => {
          ingestFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {!image ? (
        <EmptyState
          dragging={dragging}
          busy={Boolean(busy)}
          onPick={() => inputRef.current?.click()}
          onDragState={setDragging}
          onDropFiles={ingestFiles}
          onSample={loadSample}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-5">
          <section className="min-w-0 space-y-3 lg:col-span-3">
            <CropStage
              src={image.previewUrl}
              imageWidth={image.width}
              imageHeight={image.height}
              crop={crop}
              cols={cols}
              rows={rows}
              tileCount={tiles.length}
              aspect={aspect}
              frame={frame}
              frameWeight={frameWeight}
              onCropChange={applyCrop}
            />
            <p className="text-xs tabular-nums text-faint">
              原画 {image.width} × {image.height} px · 切り枠 {crop.width} × {crop.height}
              {native ? "" : ` → 添付 ${out.width} × ${out.height} px`}
              {" · "}
              {image.name}
            </p>
          </section>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:col-span-2 lg:self-start">
            <div className="rounded-xl bg-surface p-4 shadow-border">
              <p className="text-xs font-medium tracking-tight text-muted">
                切りたいサイズ
              </p>
              <p className="mt-1 text-xs text-faint">
                比を選ぶと、その形のまま大きさを変えられるよ。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="chip"
                  variant={
                    isFullFrame(crop, image.width, image.height) && !aspect
                      ? "default"
                      : "outline"
                  }
                  onClick={() => {
                    setAspect(null);
                    applyCrop(fullFrame(image.width, image.height));
                  }}
                >
                  全体
                </Button>
                {RATIO_PRESETS.map((preset) => {
                  const on = locksEqual(aspect, preset.lock);
                  return (
                    <Button
                      key={preset.label}
                      size="chip"
                      variant={on ? "default" : "outline"}
                      onClick={() => applyAspect(preset.lock)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              <RatioPair lock={aspect} onCommit={applyAspect} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-sm text-fg">幅</span>
                  <SizeField
                    value={crop.width}
                    max={image.width}
                    ariaLabel="切り枠の幅"
                    onCommit={(n) =>
                      applyCrop(
                        setCropSize(
                          crop,
                          image.width,
                          image.height,
                          n,
                          crop.height,
                          aspect,
                          "width",
                        ),
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-fg">高さ</span>
                  <SizeField
                    value={crop.height}
                    max={image.height}
                    ariaLabel="切り枠の高さ"
                    onCommit={(n) =>
                      applyCrop(
                        setCropSize(
                          crop,
                          image.width,
                          image.height,
                          crop.width,
                          n,
                          aspect,
                          "height",
                        ),
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl bg-surface p-4 shadow-border">
              <p className="text-xs font-medium tracking-tight text-muted">
                スライス
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stepper
                  label="横"
                  hint="列"
                  value={cols}
                  min={MIN_GRID}
                  max={maxCols}
                  onChange={setCols}
                />
                <Stepper
                  label="縦"
                  hint="行"
                  value={rows}
                  min={MIN_GRID}
                  max={maxRows}
                  onChange={setRows}
                />
              </div>

              <p className="mt-4 text-sm text-muted">
                <span className="tabular-nums text-fg">{tiles.length}</span>
                枚 · 各
                <span className="tabular-nums text-fg">
                  {" "}
                  {formatPxRange(widthRange)} × {formatPxRange(heightRange)}
                </span>{" "}
                px
              </p>
              <p className="mt-1 text-xs text-faint">
                切り枠の中だけを、すきまなく切る。
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                  const on = preset.cols === cols && preset.rows === rows;
                  return (
                    <Button
                      key={preset.label}
                      size="chip"
                      variant={on ? "default" : "outline"}
                      onClick={() => {
                        setCols(Math.min(preset.cols, maxCols));
                        setRows(Math.min(preset.rows, maxRows));
                      }}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-surface p-4 shadow-border">
              <p className="text-xs font-medium tracking-tight text-muted">
                添付サイズ
              </p>
              <p className="mt-1 text-xs text-faint">
                たてよこ比は切り枠のまま。原寸 {crop.width} × {crop.height}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SIZE_PRESETS.map((preset) => {
                  const next = preset.apply(crop.width, crop.height);
                  const on =
                    next.width === out.width && next.height === out.height;
                  return (
                    <Button
                      key={preset.label}
                      size="chip"
                      variant={on ? "default" : "outline"}
                      onClick={() => applyOut(next)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-sm text-fg">幅</span>
                  <SizeField
                    value={out.width}
                    ariaLabel="添付の幅"
                    onCommit={(n) =>
                      applyOut(sizeFromWidth(crop.width, crop.height, n))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-fg">高さ</span>
                  <SizeField
                    value={out.height}
                    ariaLabel="添付の高さ"
                    onCommit={(n) =>
                      applyOut(sizeFromHeight(crop.width, crop.height, n))
                    }
                  />
                </label>
              </div>
              <p className="mt-3 text-xs tabular-nums text-muted">
                {Math.round(scalePct)}% · 各タイル{" "}
                <span className="text-fg">
                  {formatPxRange(widthRange)} × {formatPxRange(heightRange)}
                </span>{" "}
                px
              </p>
            </div>

            <div className="rounded-xl bg-surface p-4 shadow-border">
              <p className="text-xs font-medium tracking-tight text-muted">枠</p>
              <p className="mt-1 text-xs text-faint">
                {frame.id === "none"
                  ? "切り取る画像のまわりに付けます。すぱっと切ると枠も一緒に切れます。"
                  : `${frame.hint}。切り取る画像の周囲に付いて、スライスで枠も切れます。`}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {FRAMES.map((item) => {
                  const on = item.id === frameId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFrameId(item.id)}
                      className="min-h-11 text-left"
                      aria-pressed={on}
                      aria-label={item.label}
                    >
                      <FrameThumb frame={item} active={on} />
                      <span
                        className={cn(
                          "mt-1 block text-center text-xs",
                          on ? "text-fg" : "text-muted",
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {frame.id !== "none" ? (
                <label className="mt-4 block">
                  <span className="text-xs text-muted">
                    太さ {Math.round(frameWeight * 100)}
                  </span>
                  <input
                    type="range"
                    min={FRAME_WEIGHT_MIN}
                    max={FRAME_WEIGHT_MAX}
                    step={0.05}
                    value={frameWeight}
                    onChange={(event) => setFrameWeight(Number(event.target.value))}
                    className="mt-2 h-11 w-full accent-primary"
                  />
                </label>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {image && tiles.length > 0 ? (
        <section className="mt-10 pb-16">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-fg">すぱっとプレビュー</h2>
            <p className="text-xs text-faint">
              {jpegToPhotos ? "タップして写真に保存" : "タップして1枚保存"}
            </p>
          </div>
          <TileBoard
            src={image.previewUrl}
            imageWidth={image.width}
            imageHeight={image.height}
            cols={cols}
            tiles={previewTiles}
            frame={frame}
            cropX={crop.x}
            cropY={crop.y}
            cropWidth={crop.width}
            cropHeight={crop.height}
            frameWeight={frameWeight}
            activeIndex={activeIndex}
            onSelect={(tile) => setActiveIndex(tile.index)}
          />

          <div className="mt-8 rounded-xl bg-surface p-4 shadow-border">
            <p className="text-xs font-medium tracking-tight text-muted">
              書き出し
            </p>
            <div className="mt-3 flex gap-2">
              {(
                [
                  ["image/png", "PNG"],
                  ["image/jpeg", "JPEG"],
                  ["image/webp", "WebP"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={mime === value ? "default" : "outline"}
                  onClick={() => setMime(value)}
                  className="flex-1"
                >
                  {label}
                </Button>
              ))}
            </div>
            {mime !== "image/png" ? (
              <label className="mt-4 block">
                <span className="text-xs text-muted">
                  品質 {Math.round(quality * 100)}
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={1}
                  step={0.02}
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="mt-2 h-11 w-full accent-primary"
                />
              </label>
            ) : null}

            {jpegToPhotos ? (
              <p className="mt-3 text-xs text-faint">
                保存すると写真アプリに入ります。
              </p>
            ) : null}

            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={Boolean(busy) || tiles.length === 0}
              onClick={() => void exportAll()}
            >
              <Download className="size-4" />
              {jpegToPhotos ? "写真に保存" : `すべて ${ext.toUpperCase()} で保存`}
            </Button>
          </div>
        </section>
      ) : null}

      {image && activePreview && activeExport ? (
        <TileDialog
          src={image.previewUrl}
          imageWidth={image.width}
          imageHeight={image.height}
          tile={activePreview}
          exportWidth={activeExport.width}
          exportHeight={activeExport.height}
          frame={frame}
          cropX={crop.x}
          cropY={crop.y}
          cropWidth={crop.width}
          cropHeight={crop.height}
          frameWeight={frameWeight}
          copied={copied}
          onClose={() => setActiveIndex(null)}
          onDownload={() => void exportTile(activeExport)}
          onCopy={() => void copyActive()}
        />
      ) : null}

      {busy ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="rounded-full bg-raised px-4 py-2 text-sm text-fg shadow-border">
            {busy}
          </div>
        </div>
      ) : null}

      <Toaster
        theme="light"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--color-surface)",
            color: "var(--color-fg)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-sans)",
          },
        }}
      />
    </main>
  );
}

function EmptyState({
  dragging,
  busy,
  onPick,
  onDragState,
  onDropFiles,
  onSample,
}: {
  dragging: boolean;
  busy: boolean;
  onPick: () => void;
  onDragState: (value: boolean) => void;
  onDropFiles: (files: FileList | File[] | null) => void;
  onSample: (src: string, name: string) => void;
}) {
  return (
    <div className="space-y-8 pb-16">
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragState(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragState(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          onDragState(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragState(false);
          onDropFiles(event.dataTransfer.files);
        }}
        className={cn(
          "enter-item paper-drop relative flex min-h-80 w-full flex-col items-center justify-center rounded-xl px-6 py-16 text-center transition-[box-shadow,background-color] duration-fast ease-out md:min-h-96",
          dragging && "shadow-border-hover ring-2 ring-primary/40",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-subtle text-primary">
          <ImagePlus className="size-6" strokeWidth={1.6} />
        </span>
        <p className="mt-5 text-lg text-fg">画像をぽいっと置いてね</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          切りたい大きさと場所を決めてから、すぱっと切れるよ。
        </p>
      </button>

      <div className="enter-item">
        <p className="mb-3 text-xs font-medium tracking-tight text-muted">
          サンプルでためす
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SAMPLES.map((sample) => (
            <button
              key={sample.src}
              type="button"
              disabled={busy}
              onClick={() => onSample(sample.src, sample.name)}
              className="group overflow-hidden rounded-lg bg-surface text-left shadow-border transition-[box-shadow] duration-quick ease-out hover:shadow-border-hover"
            >
              <img
                src={sample.src}
                alt={sample.label}
                className="aspect-sample h-auto w-full object-cover"
              />
              <span className="block px-3 py-2.5 text-sm text-muted group-hover:text-fg">
                {sample.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm text-fg">{label}</span>
        <span className="text-xs text-faint">{hint}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`${label}を減らす`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          <Minus className="size-4" />
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const n = Number(event.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className="h-11 min-w-0 flex-1 rounded-md bg-subtle text-center font-medium text-fg tabular-nums shadow-border focus:ring-2 focus:ring-primary/40 focus:outline-none"
          aria-label={label}
        />
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`${label}を増やす`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function SizeField({
  value,
  onCommit,
  ariaLabel,
  min = 16,
  max = 8192,
}: {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n > 0) onCommit(n);
    else setText(String(value));
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="h-11 w-full rounded-md bg-subtle text-center font-medium text-fg tabular-nums shadow-border focus:ring-2 focus:ring-primary/40 focus:outline-none"
      aria-label={ariaLabel}
    />
  );
}

function RatioPair({
  lock,
  onCommit,
}: {
  lock: AspectLock;
  onCommit: (lock: { w: number; h: number }) => void;
}) {
  const [w, setW] = useState(lock ? String(lock.w) : "");
  const [h, setH] = useState(lock ? String(lock.h) : "");
  useEffect(() => {
    setW(lock ? String(lock.w) : "");
    setH(lock ? String(lock.h) : "");
  }, [lock]);
  const commit = (nextW: string, nextH: string) => {
    const a = Number(nextW);
    const b = Number(nextH);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      onCommit({ w: Math.max(1, Math.round(a)), h: Math.max(1, Math.round(b)) });
      return;
    }
    setW(lock ? String(lock.w) : "");
    setH(lock ? String(lock.h) : "");
  };
  return (
    <div className="mt-4 flex items-end gap-2">
      <label className="block min-w-0 flex-1">
        <span className="mb-2 block text-sm text-fg">比 横</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          placeholder="—"
          value={w}
          onChange={(event) => setW(event.target.value)}
          onBlur={() => commit(w, h)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-11 w-full rounded-md bg-subtle text-center font-medium text-fg tabular-nums shadow-border focus:ring-2 focus:ring-primary/40 focus:outline-none"
          aria-label="比の横"
        />
      </label>
      <span className="mb-3 text-muted">:</span>
      <label className="block min-w-0 flex-1">
        <span className="mb-2 block text-sm text-fg">縦</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          placeholder="—"
          value={h}
          onChange={(event) => setH(event.target.value)}
          onBlur={() => commit(w, h)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-11 w-full rounded-md bg-subtle text-center font-medium text-fg tabular-nums shadow-border focus:ring-2 focus:ring-primary/40 focus:outline-none"
          aria-label="比の縦"
        />
      </label>
    </div>
  );
}

function TileDialog({
  src,
  imageWidth,
  imageHeight,
  tile,
  exportWidth,
  exportHeight,
  frame,
  cropX,
  cropY,
  cropWidth,
  cropHeight,
  frameWeight = 1,
  copied,
  onClose,
  onDownload,
  onCopy,
}: {
  src: string;
  imageWidth: number;
  imageHeight: number;
  tile: Tile;
  exportWidth: number;
  exportHeight: number;
  frame: FrameDef;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  frameWeight?: number;
  copied: boolean;
  onClose: () => void;
  onDownload: () => void;
  onCopy: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="タイルのプレビュー"
        className="relative w-full max-w-lg rounded-xl bg-surface p-3 shadow-border sm:p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-sm text-muted hover:bg-subtle hover:text-fg"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </button>
        <div
          className="overflow-hidden rounded-none bg-transparent"
          style={{ aspectRatio: `${tile.width} / ${tile.height}` }}
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{ containerType: "size" }}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={tileSpriteStyle(tile, imageWidth, imageHeight)}
            />
            <CroppedFrameOverlay
              frame={frame}
              tile={tile}
              originX={cropX}
              originY={cropY}
              originWidth={cropWidth}
              originHeight={cropHeight}
              weight={frameWeight}
            />
          </div>
        </div>
        <p className="mt-3 text-sm tabular-nums text-muted">
          {tile.row + 1}行 {tile.col + 1}列 · {exportWidth} × {exportHeight} px
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={onDownload}>
            <Download className="size-4" />
            このタイルを保存
          </Button>
          <Button variant="outline" className="flex-1" onClick={onCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "コピー済み" : "コピー"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function yieldFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
