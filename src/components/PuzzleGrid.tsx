import type { RefCallback, KeyboardEvent } from "react";
import type { DailyPuzzle } from "../lib/daily";
export interface GridProps {
  puzzle: DailyPuzzle;
  letters: Record<string, string>;
  hintCells?: number[];
  editable?: boolean;
  inputRef?: (cell: number) => RefCallback<HTMLInputElement>;
  onFocus?: (cell: number) => void;
  onEdit?: (cell: number, value: string) => void;
  onKeyDown?: (cell: number, event: KeyboardEvent<HTMLInputElement>) => void;
}
export function PuzzleGrid({
  puzzle,
  letters,
  hintCells = [],
  editable = false,
  inputRef,
  onEdit,
  onKeyDown,
  onFocus,
}: GridProps) {
  const width = puzzle.shape.rows[0].length;
  const inside = puzzle.silhouette.flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === "." ? [{ x, y }] : [])),
  );
  const minX = Math.min(...inside.map((c) => c.x)),
    maxX = Math.max(...inside.map((c) => c.x)),
    minY = Math.min(...inside.map((c) => c.y)),
    maxY = Math.max(...inside.map((c) => c.y));
  const cells = [];
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const cell = y * width + x,
        playable = puzzle.shape.rows[y][x] === ".",
        seed = !!puzzle.seeds[cell],
        hinted = hintCells.includes(cell),
        outside = puzzle.silhouette[y][x] === "#";
      const label = `Row ${y + 1}, column ${x + 1}${seed ? ", fixed seed" : hinted ? ", hint letter" : ""}`;
      cells.push(
        outside ? (
          <span className="outside" key={cell} aria-hidden="true" />
        ) : !playable ? (
          <span className="solid" key={cell} aria-hidden="true" />
        ) : editable ? (
          <input
            key={cell}
            ref={inputRef?.(cell)}
            className={`letter-cell ${seed ? "seed" : ""} ${hinted ? "hinted" : ""}`}
            aria-label={label}
            readOnly={seed || hinted}
            value={letters[cell] ?? ""}
            maxLength={1}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            onFocus={(event) => {
              event.currentTarget.select();
              onFocus?.(cell);
            }}
            onChange={(event) => {
              const letter = event.target.value
                .toUpperCase()
                .replace(/[^A-Z]/g, "")
                .slice(-1);
              onEdit?.(cell, letter);
            }}
            onKeyDown={(event) => onKeyDown?.(cell, event)}
          />
        ) : (
          <span
            role="img"
            key={cell}
            className={`letter-cell ${seed ? "seed" : ""} ${hinted ? "hinted" : ""}`}
            aria-label={`${label}: ${letters[cell] ?? "empty"}`}
          >
            {letters[cell] ?? ""}
          </span>
        ),
      );
    }
  return (
    <div
      className="silhouette-grid"
      role="group"
      aria-label={`${puzzle.shape.name} puzzle grid`}
      style={{
        gridTemplateColumns: `repeat(${maxX - minX + 1},minmax(0,1fr))`,
      }}
    >
      {cells}
    </div>
  );
}
