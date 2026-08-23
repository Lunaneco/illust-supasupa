import type { CSSProperties } from "react";
import type { FrameDef } from "@/lib/frames";
import type { Tile } from "@/lib/split";
import { cn } from "@/lib/utils";

export function FrameOverlay({
  frame,
  weight = 1,
  className,
}: {
  frame: FrameDef;
  weight?: number;
  className?: string;
}) {
  if (frame.kind === "none") return null;

  if (frame.kind === "slice" && frame.src && frame.slice) {
    const pct = (frame.slice / 1024) * 100 * weight;
    return (
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0", className)}
        style={{
          borderStyle: "solid",
          borderWidth: `${pct}cqmin`,
          borderImageSource: `url(${frame.src})`,
          borderImageSlice: frame.slice,
          borderImageWidth: `${pct}cqmin`,
          borderImageRepeat: "stretch",
          boxSizing: "border-box",
        }}
      />
    );
  }

  if (frame.id === "magazine") {
    const gap = Math.max(0.6, 1.8 * weight);
    const line = Math.max(1, 2 * weight);
    return (
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0", className)}
      >
        <div
          className="absolute inset-0 border-solid border-fg"
          style={{ borderWidth: line }}
        />
        <div
          className="absolute border border-fg/70"
          style={{ inset: `${gap}%` }}
        />
      </div>
    );
  }

  if (frame.id === "brass") {
    const line = Math.max(1.5, 3 * weight);
    const gap = Math.max(0.6, 1.3 * weight);
    return (
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
        <div
          className="absolute inset-0 border-solid border-primary"
          style={{ borderWidth: line }}
        />
        <div className="absolute border border-primary/80" style={{ inset: `${gap}%` }} />
      </div>
    );
  }

  return null;
}

export function FrameThumb({ frame, active }: { frame: FrameDef; active: boolean }) {
  return (
    <span
      className={cn(
        "relative block aspect-square w-full overflow-hidden rounded-sm bg-subtle",
        active && "ring-2 ring-primary/70",
      )}
      style={{ containerType: "size" }}
    >
      <span className="absolute inset-[18%] bg-raised" />
      <FrameOverlay frame={frame} />
    </span>
  );
}

export function CroppedFrameOverlay({
  frame,
  tile,
  originX,
  originY,
  originWidth,
  originHeight,
  weight = 1,
}: {
  frame: FrameDef;
  tile: Tile;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  weight?: number;
}) {
  if (frame.kind === "none") return null;
  const style: CSSProperties = {
    width: `${(originWidth / tile.width) * 100}%`,
    height: `${(originHeight / tile.height) * 100}%`,
    left: `${(-(tile.x - originX) / tile.width) * 100}%`,
    top: `${(-(tile.y - originY) / tile.height) * 100}%`,
    containerType: "size",
  };
  return (
    <div className="pointer-events-none absolute" style={style}>
      <FrameOverlay frame={frame} weight={weight} />
    </div>
  );
}

