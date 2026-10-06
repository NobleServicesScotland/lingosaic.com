import { parseShape, isComplete } from "./puzzle";
import { restoreProgress, storageKey } from "./player";
import { letterHash, type DailyPuzzle, type DailyProgress } from "./daily";
export function dailyStorageKey(puzzle: DailyPuzzle): string {
  return `lingosaic:daily:v2:${puzzle.id}:${puzzle.validation.hash}`;
}
export function freshDailyProgress(): DailyProgress {
  return {
    version: 1,
    letters: {},
    startedAt: null,
    finishedAt: null,
    hintCells: [],
    hintsUsed: 0,
  };
}
export async function restoreDailyProgress(
  puzzle: DailyPuzzle,
  raw: string | null,
  now = Date.now(),
): Promise<DailyProgress> {
  if (!raw) return freshDailyProgress();
  try {
    const saved = JSON.parse(raw);
    const progress = await restoreProgress(puzzle, raw, now);
    const cells = parseShape(puzzle.shape).cells;
    const hintCells: number[] = Array.isArray(saved.hintCells)
      ? [
          ...new Set<number>(
            saved.hintCells.filter(
              (cell: unknown) =>
                typeof cell === "number" &&
                cells.includes(cell) &&
                !puzzle.seeds[cell],
            ),
          ),
        ]
      : [];
    // Earlier saves counted each single-letter hint as one use. Preserve those results.
    const hintsUsed =
      saved.hintsUsed === undefined
        ? Math.min(hintCells.length, 3)
        : saved.hintsUsed;
    if (
      !Number.isInteger(hintsUsed) ||
      hintsUsed < 0 ||
      hintsUsed > 3 ||
      (hintCells.length > 0 && hintsUsed === 0)
    )
      return freshDailyProgress();
    for (const cell of hintCells)
      if (
        letterHash(puzzle.id, cell, progress.letters[cell] ?? "") !==
        puzzle.cell_hashes[cell]
      )
        return freshDailyProgress();
    if (progress.startedAt === null) return freshDailyProgress();
    if (
      progress.finishedAt !== null &&
      !(await isComplete(puzzle, { ...progress.letters, ...puzzle.seeds }))
    )
      progress.finishedAt = null;
    return { ...progress, hintCells, hintsUsed };
  } catch {
    return freshDailyProgress();
  }
}
export async function loadDailyProgress(
  puzzle: DailyPuzzle,
): Promise<{ progress: DailyProgress; storageAvailable: boolean }> {
  try {
    if (localStorage.getItem("lingosaic:save-progress") === "false")
      return { progress: freshDailyProgress(), storageAvailable: true };
    const raw = localStorage.getItem(dailyStorageKey(puzzle));
    // Preserve existing result/timestamp data when migrating the previous player.
    const previous = raw ?? localStorage.getItem(storageKey(puzzle));
    return {
      progress: await restoreDailyProgress(puzzle, previous),
      storageAvailable: true,
    };
  } catch {
    return { progress: freshDailyProgress(), storageAvailable: false };
  }
}
