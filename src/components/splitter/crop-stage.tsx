import { useCallback, useRef, useState } from "react";
import { sliceBounds } from "@/lib/split";
import { FrameOverlay } from "@/components/splitter/frame-overlay";
import type { FrameDef } from "@/lib/frames";
import {
  moveCrop,
  resizeCrop,
  type AspectLock,
  type CropRect,
  type ResizeHandle,
} from "@/lib/crop";
import { cn } from "@/lib/utils";

const HANDLES: { id: ResizeHandle; className: string; cursor: string }[] = [
  { id: "nw", className: "top-0 left-0", cursor: "cursor-nwse-resize" },
  { id: "n", className: "top-0 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { id: "ne", className: "top-0 right-0", cursor: "cursor-nesw-resize" },
  { id: "e", className: "top-1/2 right-0 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { id: "se", className: "right-0 bottom-0", cursor: "cursor-nwse-resize" },
  { id: "s", className: "bottom-0 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { id: "sw", className: "bottom-0 left-0", cursor: "cursor-nesw-resize" },
  { id: "w", className: "top-1/2 left-0 -translate-y-1/2", cursor: "cursor-ew-resize" },
];

type CropStageProps = {
  src: string;
  imageWidth: number;
  imageHeight: number;
  crop: CropRect;
  cols: number;
  rows: number;
  tileCount: number;
  aspect: AspectLock;
  frame: FrameDef;
  frameWeight?: number;
  onCropChange: (crop: CropRect) => void;
};

export function CropStage({
  src,
  imageWidth,
  imageHeight,
  crop,
  cols,
  rows,
  tileCount,
  aspect,
  frame,
  frameWeight = 1,
  onCropChange,
}: CropStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "move" | ResizeHandle;
    originX: number;
    originY: number;
    start: CropRect;
  } | null>(null);
  const [drag, setDrag] = useState<"move" | ResizeHandle | null>(null);

  const toImage = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const box = el.getBoundingClientRect();
      const x = ((clientX - box.left) / box.width) * imageWidth;
      const y = ((clientY - box.top) / box.height) * imageHeight;
      return { x, y };
    },
    [imageWidth, imageHeight],
  );

  const beginDrag = (
    event: React.PointerEvent,
    mode: "move" | ResizeHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const point = toImage(event.clientX, event.clientY);
    dragRef.current = {
      mode,
      originX: point.x,
      originY: point.y,
      start: crop,
    };
    setDrag(mode);
    stageRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const session = dragRef.current;
    if (!session) return;
    const point = toImage(event.clientX, event.clientY);
    const dx = point.x - session.originX;
    const dy = point.y - session.originY;
    if (session.mode === "move") {
      onCropChange(moveCrop(session.start, dx, dy, imageWidth, imageHeight));
      return;
    }
    onCropChange(
      resizeCrop(
        session.start,
        session.mode,
        dx,
        dy,
        imageWidth,
        imageHeight,
        aspect,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const xs = sliceBounds(crop.width, cols);
  const ys = sliceBounds(crop.height, rows);
  const left = (crop.x / imageWidth) * 100;
  const top = (crop.y / imageHeight) * 100;
  const width = (crop.width / imageWidth) * 100;
  const height = (crop.height / imageHeight) * 100;

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative touch-none overflow-hidden rounded-none bg-subtle shadow-border select-none",
        drag === "move" && "cursor-grabbing",
      )}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="group"
      aria-label="切り取る範囲"
    >
      <img
        src={src}
        alt="分割対象の画像"
        className="pointer-events-none block h-auto w-full"
        draggable={false}
      />

      <div
        className="absolute top-0 right-0 left-0 bg-fg/35"
        style={{ height: `${top}%` }}
      />
      <div
        className="absolute right-0 bottom-0 left-0 bg-fg/35"
        style={{ height: `${100 - top - height}%` }}
      />
      <div
        className="absolute bg-fg/35"
        style={{ top: `${top}%`, height: `${height}%`, width: `${left}%` }}
      />
      <div
        className="absolute right-0 bg-fg/35"
        style={{
          top: `${top}%`,
          height: `${height}%`,
          width: `${100 - left - width}%`,
        }}
      />

      <div
        className={cn(
          "absolute overflow-hidden",
          frame.kind === "none" ? "outline outline-2 outline-primary" : "",
          drag && drag !== "move" ? "" : "cursor-grab",
        )}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          containerType: "size",
        }}
        onPointerDown={(event) => beginDrag(event, "move")}
      >
        <FrameOverlay frame={frame} weight={frameWeight} />
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {xs.slice(1, -1).map((x) => (
            <div
              key={`v-${x}`}
              className="absolute top-0 bottom-0 w-px bg-primary/70"
              style={{ left: `${(x / crop.width) * 100}%` }}
            />
          ))}
          {ys.slice(1, -1).map((y) => (
            <div
              key={`h-${y}`}
              className="absolute right-0 left-0 h-px bg-primary/70"
              style={{ top: `${(y / crop.height) * 100}%` }}
            />
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-xs bg-surface/90 px-1.5 py-0.5 text-xs tabular-nums text-fg">
          {crop.width} × {crop.height}
        </span>
        {HANDLES.map((handle) => (
          <div
            key={handle.id}
            className={cn(
              "absolute z-10 flex size-11 items-center justify-center",
              handle.className,
              handle.cursor,
            )}
            onPointerDown={(event) => beginDrag(event, handle.id)}
            aria-hidden="true"
          >
            <span className="size-3 rounded-xs bg-primary shadow-border" />
          </div>
        ))}
      </div>

      <span className="sr-only">
        {crop.width}×{crop.height}を{cols}列{rows}行、{tileCount}枚に分割。枠をドラッグして場所を、角をドラッグして大きさを変えられます。
      </span>
    </div>
  );
}
