import { isComplete, parseShape, type Puzzle } from "./puzzle";
export interface Progress {
  version: 1;
  letters: Record<string, string>;
  startedAt: number | null;
  finishedAt: number | null;
}
export function freshProgress(): Progress {
  return { version: 1, letters: {}, startedAt: null, finishedAt: null };
}
export function storageKey(puzzle: Puzzle): string {
  return `lingosaic:progress:v1:${puzzle.id}:${puzzle.validation.hash}`;
}
export function elapsedSeconds(progress: Progress, now = Date.now()): number {
  return progress.startedAt === null
    ? 0
    : Math.floor(
        Math.max(0, (progress.finishedAt ?? now) - progress.startedAt) / 1000,
      );
}
export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const h = Math.floor(value / 3600),
    m = Math.floor(value / 60) % 60,
    s = value % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
export async function restoreProgress(
  puzzle: Puzzle,
  raw: string | null,
  now = Date.now(),
): Promise<Progress> {
  if (!raw) return freshProgress();
  try {
    const saved = JSON.parse(raw) as Progress;
    if (
      saved.version !== 1 ||
      !saved.letters ||
      typeof saved.letters !== "object"
    )
      return freshProgress();
    const cells = parseShape(puzzle.shape).cells;
    const letters: Record<string, string> = {};
    for (const [key, letter] of Object.entries(saved.letters))
      if (
        /^(0|[1-9]\d*)$/.test(key) &&
        cells.includes(Number(key)) &&
        !puzzle.seeds[key] &&
        typeof letter === "string" &&
        /^[A-Z]$/.test(letter)
      )
        letters[key] = letter;
    const startedAt =
      typeof saved.startedAt === "number" &&
      Number.isFinite(saved.startedAt) &&
      saved.startedAt >= 0 &&
      saved.startedAt <= now
        ? saved.startedAt
        : null;
    let finishedAt =
      startedAt !== null &&
      typeof saved.finishedAt === "number" &&
      Number.isFinite(saved.finishedAt) &&
      saved.finishedAt >= startedAt &&
      saved.finishedAt <= now
        ? saved.finishedAt
        : null;
    if (
      finishedAt !== null &&
      !(await isComplete(puzzle, { ...letters, ...puzzle.seeds }))
    )
      finishedAt = null;
    return { version: 1, letters, startedAt, finishedAt };
  } catch {
    return freshProgress();
  }
}
export function nextCell(
  rows: string[],
  cell: number,
  dx: number,
  dy: number,
): number | undefined {
  const width = rows[0].length;
  let x = (cell % width) + dx,
    y = Math.floor(cell / width) + dy;
  while (x >= 0 && x < width && y >= 0 && y < rows.length) {
    if (rows[y][x] === ".") return y * width + x;
    x += dx;
    y += dy;
  }
  return undefined;
}
