import type { CSSProperties } from "react";
import type { Tile } from "@/lib/split";
import { cn } from "@/lib/utils";

export function tileSpriteStyle(
  tile: Tile,
  imageWidth: number,
  imageHeight: number,
): CSSProperties {
  return {
    width: `calc(${(imageWidth / tile.width) * 100}% + 2px)`,
    height: `calc(${(imageHeight / tile.height) * 100}% + 2px)`,
    left: `calc(${(-tile.x / tile.width) * 100}% - 1px)`,
    top: `calc(${(-tile.y / tile.height) * 100}% - 1px)`,
  };
}

type TileBoardProps = {
  src: string;
  imageWidth: number;
  imageHeight: number;
  cols: number;
  tiles: Tile[];
  activeIndex: number | null;
  onSelect: (tile: Tile) => void;
};

export function TileBoard({
  src,
  imageWidth,
  imageHeight,
  cols,
  tiles,
  activeIndex,
  onSelect,
}: TileBoardProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => {
        const selected = activeIndex === tile.index;
        return (
          <button
            key={tile.index}
            type="button"
            onClick={() => onSelect(tile)}
            className={cn(
              "group relative min-h-11 overflow-hidden rounded-none bg-transparent text-left transition-[box-shadow,transform] duration-quick ease-out",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              selected && "ring-2 ring-primary/70",
            )}
            aria-label={`タイル ${tile.row + 1}行 ${tile.col + 1}列、${tile.width}×${tile.height}ピクセル`}
          >
            <div
              className="relative overflow-hidden"
              style={{ aspectRatio: `${tile.width} / ${tile.height}` }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={tileSpriteStyle(tile, imageWidth, imageHeight)}
              />
            </div>
            <span className="pointer-events-none absolute top-1 left-1 rounded-xs bg-surface/80 px-1.5 py-0.5 text-xs tabular-nums text-fg">
              {tile.row + 1}-{tile.col + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
