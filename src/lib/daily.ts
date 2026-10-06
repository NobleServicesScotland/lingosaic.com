import { sha256 } from "@noble/hashes/sha2.js";
import { isComplete, parsePuzzle, parseShape, type Puzzle } from "./puzzle";
import type { Progress } from "./player";
export interface DailyPuzzle extends Puzzle {
  date: string;
  daily_number: number;
  description: string;
  silhouette: string[];
  cell_hashes: Record<string, string>;
}
export interface CatalogEntry {
  id: string;
  date: string;
  theme: string;
}
export interface DailyProgress extends Progress {
  hintCells: number[];
  hintsUsed: number;
}
export function letterHash(id: string, cell: number, letter: string): string {
  return [
    ...sha256(
      new TextEncoder().encode(`lingosaic-letter-v1:${id}:${cell}:${letter}`),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function parseDailyPuzzle(input: unknown): DailyPuzzle {
  const p = input as DailyPuzzle;
  parsePuzzle(p);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
    !Number.isInteger(p.daily_number) ||
    p.daily_number < 1 ||
    typeof p.description !== "string"
  )
    throw new Error("Invalid daily metadata");
  const layout = parseShape(p.shape);
  if (
    !Array.isArray(p.silhouette) ||
    p.silhouette.length !== layout.height ||
    p.silhouette.some(
      (row, y) =>
        typeof row !== "string" ||
        row.length !== layout.width ||
        !/^[.#]+$/.test(row) ||
        [...row].some((c, x) => p.shape.rows[y][x] === "." && c !== "."),
    )
  )
    throw new Error("Invalid silhouette");
  if (
    !p.cell_hashes ||
    Object.keys(p.cell_hashes).length !== layout.cells.length ||
    layout.cells.some(
      (cell) => !/^[a-f0-9]{64}$/.test(p.cell_hashes[cell] ?? ""),
    )
  )
    throw new Error("Invalid hint validators");
  return p;
}
export function correctLetter(puzzle: DailyPuzzle, cell: number): string {
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    if (letterHash(puzzle.id, cell, letter) === puzzle.cell_hashes[cell])
      return letter;
  throw new Error("Hint letter could not be validated");
}
export async function exampleGrid(
  puzzle: DailyPuzzle,
): Promise<Record<string, string>> {
  const grid = Object.fromEntries(
    parseShape(puzzle.shape).cells.map((cell) => [
      cell,
      correctLetter(puzzle, cell),
    ]),
  );
  if (!(await isComplete(puzzle, grid)))
    throw new Error("Example does not match completion validator");
  return grid;
}
export function hintTarget(
  puzzle: DailyPuzzle,
  progress: DailyProgress,
): ReturnType<typeof parseShape>["slots"][number] | undefined {
  if (
    progress.startedAt === null ||
    progress.finishedAt !== null ||
    progress.hintsUsed >= 3
  )
    return undefined;
  return parseShape(puzzle.shape).slots.find((slot) =>
    slot.cells.some(
      (cell) =>
        !puzzle.seeds[cell] &&
        letterHash(puzzle.id, cell, progress.letters[cell] ?? "") !==
          puzzle.cell_hashes[cell],
    ),
  );
}
export function applyHint(
  puzzle: DailyPuzzle,
  progress: DailyProgress,
): DailyProgress {
  const slot = hintTarget(puzzle, progress);
  if (!slot) return progress;
  const letters = { ...progress.letters };
  const hinted = new Set(progress.hintCells);
  for (const cell of slot.cells) {
    if (puzzle.seeds[cell]) continue;
    letters[cell] = correctLetter(puzzle, cell);
    hinted.add(cell);
  }
  return {
    ...progress,
    letters,
    hintCells: [...hinted],
    hintsUsed: progress.hintsUsed + 1,
  };
}

export function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export function selectDate(
  catalog: CatalogEntry[],
  today: string,
  development: boolean,
  requested?: string | null,
): string | undefined {
  const requestedEntry = catalog.find(
    (entry) => entry.id === requested || entry.date === requested,
  );
  if (requested)
    return requestedEntry && (development || requestedEntry.date <= today)
      ? requestedEntry.date
      : undefined;
  return (
    catalog.find((entry) => entry.date === today)?.date ??
    (development ? catalog[0]?.date : undefined)
  );
}
export function appBaseUrl(
  location: Pick<Location, "origin" | "pathname"> = window.location,
): URL {
  const path = location.pathname
    .replace(/index\.html$/, "")
    .replace(/puzzle\/[^/]+\/?$/, "");
  return new URL(path.endsWith("/") ? path : `${path}/`, location.origin);
}
