import { useEffect, useRef, type ReactNode } from "react";
import { PuzzleGrid } from "./PuzzleGrid";
import { formatDate, type DailyPuzzle } from "../lib/daily";
import { formatTime } from "../lib/player";
export function SolutionView({
  puzzle,
  letters,
  hintCells = [],
  hintsUsed = 0,
  elapsed,
  mode = "solved",
  children,
}: {
  puzzle: DailyPuzzle;
  letters: Record<string, string>;
  hintCells?: number[];
  hintsUsed?: number;
  elapsed?: number;
  mode?: "solved" | "example" | "inspector";
  children?: ReactNode;
}) {
  const result = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mode === "solved") result.current?.focus();
  }, [mode]);
  return (
    <article
      ref={result}
      tabIndex={-1}
      aria-label={mode === "solved" ? "Puzzle solved" : "Solved puzzle example"}
      className="puzzle-card solution-card"
    >
      <p className="eyebrow">
        {mode === "solved"
          ? "Beautifully pieced together!"
          : mode === "example"
            ? "Yesterday’s example"
            : "Solution preview"}{" "}
        · #{puzzle.daily_number}
      </p>
      <h2>{puzzle.theme.name}</h2>
      <p className="date-line">
        {formatDate(puzzle.date)} · {puzzle.shape.name}
      </p>
      <p className="description">{puzzle.description}</p>
      {elapsed !== undefined && (
        <div className="result-stats">
          <span>
            Solved in <strong>{formatTime(elapsed)}</strong>
          </span>
          <span>
            {hintsUsed
              ? `${hintsUsed} ${hintsUsed === 1 ? "hint" : "hints"} used`
              : "No hints used ✨"}
          </span>
        </div>
      )}
      <PuzzleGrid puzzle={puzzle} letters={letters} hintCells={hintCells} />
      {children}
    </article>
  );
}
