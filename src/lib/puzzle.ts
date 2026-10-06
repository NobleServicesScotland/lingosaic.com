import { sha256 } from "@noble/hashes/sha2.js";

export const GENERATOR_VERSION = "1.0.0";
export interface Shape {
  schema_version: 1;
  id: string;
  name: string;
  rows: string[];
  seeds?: Record<string, string>;
}
export interface WordList {
  schema_version: 1;
  theme: { id: string; name: string };
  words: { display?: string; grid_entry: string }[];
}
export interface Slot {
  id: number;
  direction: "across" | "down";
  cells: number[];
}
export interface Layout {
  shape: Shape;
  width: number;
  height: number;
  cells: number[];
  slots: Slot[];
  intersections: {
    a: number;
    b: number;
    aOffset: number;
    bOffset: number;
    cell: number;
  }[];
}
export interface Puzzle {
  schema_version: 1;
  id: string;
  generator_version: string;
  seed: string;
  theme: WordList["theme"];
  shape: Shape;
  seeds: Record<string, string>;
  validation: { algorithm: "SHA-256"; canonical_version: 1; hash: string };
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function parseShape(input: unknown): Layout {
  const s = input as Shape;
  assert(
    s &&
      s.schema_version === 1 &&
      typeof s.id === "string" &&
      s.id.length > 0 &&
      typeof s.name === "string" &&
      s.name.length > 0,
    "Invalid shape header (expected schema_version 1, id, name)",
  );
  assert(
    Array.isArray(s.rows) && s.rows.length > 0 && s.rows.length <= 20,
    "Shape must have 1–20 rows",
  );
  const width = typeof s.rows[0] === "string" ? s.rows[0].length : 0;
  assert(
    width > 0 &&
      width <= 15 &&
      s.rows.every(
        (r) => typeof r === "string" && r.length === width && /^[.#]+$/.test(r),
      ),
    "Shape rows must have equal width (1–15), using only . and #",
  );
  const cells = s.rows.flatMap((r, y) =>
    [...r].flatMap((c, x) => (c === "." ? [y * width + x] : [])),
  );
  assert(cells.length, "Shape has no playable cells");
  const slots: Slot[] = [];
  for (const direction of ["across", "down"] as const) {
    const outer = direction === "across" ? s.rows.length : width;
    const inner = direction === "across" ? width : s.rows.length;
    for (let a = 0; a < outer; a++) {
      let run: number[] = [];
      const flush = () => {
        if (run.length >= 3)
          slots.push({ id: slots.length, direction, cells: run });
        run = [];
      };
      for (let b = 0; b < inner; b++) {
        const x = direction === "across" ? b : a,
          y = direction === "across" ? a : b;
        if (s.rows[y][x] === ".") run.push(y * width + x);
        else flush();
      }
      flush();
    }
  }
  assert(slots.length, "Shape has no word slots");
  assert(
    cells.every((c) => slots.some((s) => s.cells.includes(c))),
    "Every playable cell must belong to at least one word slot",
  );
  const intersections: Layout["intersections"] = [];
  for (let a = 0; a < slots.length; a++)
    for (let b = a + 1; b < slots.length; b++) {
      slots[a].cells.forEach((cell, aOffset) => {
        const bOffset = slots[b].cells.indexOf(cell);
        if (bOffset >= 0) intersections.push({ a, b, aOffset, bOffset, cell });
      });
    }
  if (s.seeds !== undefined) validateSeeds(cells, s.seeds);
  return {
    shape: {
      schema_version: 1,
      id: s.id,
      name: s.name,
      rows: [...s.rows],
      ...(s.seeds !== undefined ? { seeds: { ...s.seeds } } : {}),
    },
    width,
    height: s.rows.length,
    cells,
    slots,
    intersections,
  };
}
function validateSeeds(cells: number[], seeds: Record<string, string>) {
  assert(
    seeds && typeof seeds === "object" && !Array.isArray(seeds),
    "Seeds must be a cell-index to uppercase-letter object",
  );
  for (const [key, letter] of Object.entries(seeds))
    assert(
      /^(0|[1-9]\d*)$/.test(key) &&
        cells.includes(Number(key)) &&
        typeof letter === "string" &&
        /^[A-Z]$/.test(letter),
      `Invalid seed cell ${key}`,
    );
}
export function parseWords(input: unknown): {
  source: WordList;
  entries: string[];
} {
  const w = input as WordList;
  assert(
    w &&
      w.schema_version === 1 &&
      w.theme &&
      typeof w.theme.id === "string" &&
      w.theme.id.length &&
      typeof w.theme.name === "string" &&
      w.theme.name.length &&
      Array.isArray(w.words) &&
      w.words.length > 0,
    "Invalid word-list header",
  );
  const entries = w.words.map((word, i) => {
    assert(
      word && typeof word.grid_entry === "string",
      `Missing grid_entry at word ${i}`,
    );
    const raw = word.grid_entry.trim();
    const entry = raw.toUpperCase();
    assert(
      /^[a-zA-Z]+$/.test(raw),
      `Invalid grid_entry ${word.grid_entry}: single alphabetic words required`,
    );
    return entry;
  });
  assert(
    new Set(entries).size === entries.length,
    "Duplicate normalized dictionary entries",
  );
  return {
    source: {
      schema_version: 1,
      theme: { id: w.theme.id, name: w.theme.name },
      words: w.words,
    },
    entries: entries.sort(),
  };
}
function shuffled(words: string[], seed: string): string[] {
  let state = 2166136261;
  for (const c of seed)
    state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ordered = [...words].sort();
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}
export interface Solution {
  grid: Record<string, string>;
  words: string[];
}
export function solve(
  layout: Layout,
  entries: string[],
  seeds: Record<string, string> = {},
  options: { seed?: string; limit?: number; maxNodes?: number } = {},
): Solution[] {
  validateSeeds(layout.cells, seeds);
  const fixed = { ...layout.shape.seeds, ...seeds };
  if (
    Object.entries(layout.shape.seeds ?? {}).some(
      ([cell, letter]) => fixed[cell] !== letter,
    )
  )
    return [];
  const limit = options.limit ?? 2;
  assert(
    Number.isInteger(limit) && limit >= 1 && limit <= 2,
    "Solution limit must be 1 or 2",
  );
  const ordered = shuffled([...new Set(entries)], options.seed ?? "count");
  const index = new Map<number, string[]>();
  for (const word of ordered) {
    assert(/^[A-Z]+$/.test(word), "Solver entries must be normalized words");
    const bucket = index.get(word.length) ?? [];
    bucket.push(word);
    index.set(word.length, bucket);
  }
  const assigned = new Map<number, string>(),
    used = new Set<string>();
  const results: Solution[] = [];
  let nodes = 0;
  const visit = (grid: Record<string, string>) => {
    if (++nodes > (options.maxNodes ?? 500_000))
      throw new Error(
        "Solver search budget exceeded; uniqueness not established",
      );
    if (assigned.size === layout.slots.length) {
      results.push({
        grid: { ...grid },
        words: layout.slots.map((s) => assigned.get(s.id)!),
      });
      return;
    }
    let next: Slot | undefined,
      candidates: string[] = [];
    for (const slot of layout.slots) {
      if (assigned.has(slot.id)) continue;
      const compatible = (index.get(slot.cells.length) ?? []).filter(
        (w) =>
          !used.has(w) &&
          slot.cells.every((c, i) => !grid[c] || grid[c] === w[i]),
      );
      if (!compatible.length) return;
      if (!next || compatible.length < candidates.length) {
        next = slot;
        candidates = compatible;
      }
    }
    for (const word of candidates) {
      assigned.set(next!.id, word);
      used.add(word);
      const filled = { ...grid };
      next!.cells.forEach((c, i) => {
        filled[c] = word[i];
      });
      visit(filled);
      assigned.delete(next!.id);
      used.delete(word);
      if (results.length >= limit) return;
    }
  };
  visit(fixed);
  return results;
}
export function generate(shape: unknown, wordList: unknown, seed: string) {
  const layout = parseShape(shape),
    dictionary = parseWords(wordList);
  const target = solve(layout, dictionary.entries, layout.shape.seeds ?? {}, {
    seed,
    limit: 1,
  })[0];
  assert(target, "No valid fill exists for this shape and dictionary");
  const seeds = { ...layout.shape.seeds };
  let count = 0;
  while (true) {
    const solutions = solve(layout, dictionary.entries, seeds);
    assert(solutions.length, "Internal error: target solution became invalid");
    if (solutions.length === 1) break;
    const competitor = solutions.find((s) =>
      layout.cells.some((c) => s.grid[c] !== target.grid[c]),
    );
    assert(competitor, "Internal error: duplicate solver solutions");
    const cell = layout.cells.find(
      (c) => competitor.grid[c] !== target.grid[c] && !seeds[c],
    );
    assert(
      cell !== undefined && count++ < layout.cells.length,
      "Seed-letter uniqueness safeguard exceeded",
    );
    seeds[cell] = target.grid[cell];
  }
  // Remove any added seed that became redundant after subsequent constraints.
  for (const key of Object.keys(seeds).reverse()) {
    if (layout.shape.seeds?.[key]) continue;
    const trial = { ...seeds };
    delete trial[key];
    if (solve(layout, dictionary.entries, trial).length === 1)
      delete seeds[key];
  }
  return { layout, dictionary, target, seeds };
}
export function canonicalGrid(
  rows: string[],
  grid: Record<string, string>,
): string {
  const width = rows[0].length;
  return (
    "lingosaic-grid-v1\n" +
    rows
      .map((row, y) =>
        [...row]
          .map((c, x) => (c === "#" ? "#" : (grid[y * width + x] ?? ".")))
          .join(""),
      )
      .join("\n")
  );
}
export async function hashGrid(
  rows: string[],
  grid: Record<string, string>,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalGrid(rows, grid));
  const digest = sha256(bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function isComplete(
  puzzle: Puzzle,
  grid: Record<string, string>,
): Promise<boolean> {
  const layout = parseShape(puzzle.shape);
  if (
    !layout.cells.every((c) => /^[A-Z]$/.test(grid[c] ?? "")) ||
    !Object.entries(puzzle.seeds).every(([c, letter]) => grid[c] === letter)
  )
    return false;
  return (await hashGrid(puzzle.shape.rows, grid)) === puzzle.validation.hash;
}
export function parsePuzzle(input: unknown): Puzzle {
  const p = input as Puzzle;
  assert(
    p &&
      p.schema_version === 1 &&
      typeof p.id === "string" &&
      p.id.length > 0 &&
      typeof p.seed === "string" &&
      typeof p.generator_version === "string",
    "Invalid puzzle header",
  );
  const layout = parseShape(p.shape);
  validateSeeds(layout.cells, p.seeds);
  assert(
    p.theme &&
      typeof p.theme.name === "string" &&
      typeof p.theme.id === "string",
    "Invalid puzzle theme",
  );
  assert(
    p.validation?.algorithm === "SHA-256" &&
      p.validation.canonical_version === 1 &&
      /^[0-9a-f]{64}$/.test(p.validation.hash),
    "Invalid completion validator",
  );
  assert(
    Object.entries(p.shape.seeds ?? {}).every(
      ([c, letter]) => p.seeds[c] === letter,
    ),
    "Puzzle seeds contradict shape seeds",
  );
  return p;
}
