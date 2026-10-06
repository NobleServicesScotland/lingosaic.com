import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  canonicalGrid,
  generate,
  hashGrid,
  isComplete,
  parsePuzzle,
  parseShape,
  parseWords,
  solve,
} from "../src/lib/puzzle";
import {
  elapsedSeconds,
  formatTime,
  freshProgress,
  nextCell,
  restoreProgress,
  storageKey,
} from "../src/lib/player";
const read = (file: string) =>
  JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const shape = read("data/shapes/demo.grid.json"),
  words = read("data/wordlists/demo.word-list.json");
const line = { schema_version: 1, id: "line", name: "Line", rows: ["..."] };
const list = (entries: string[]) => ({
  schema_version: 1,
  theme: { id: "test", name: "Test" },
  words: entries.map((grid_entry) => ({ grid_entry })),
});
test("shape rejects malformed dimensions, masks, oversized grids, orphan cells and invalid seeds", () => {
  for (const rows of [
    [],
    ["...", ".."],
    ["..X"],
    ["................"],
    ["...", "###", "#.#"],
    Array(21).fill("..."),
  ])
    assert.throws(() => parseShape({ ...line, rows }));
  assert.throws(() => parseShape({ ...line, seeds: { 3: "A" } }));
  assert.throws(() => parseShape({ ...line, seeds: { 0: "ab" } }));
  assert.throws(() => parseShape({ ...line, schema_version: 2 }));
});
test("extracts every maximal slot, ignores short runs, respects interior separators and computes crossings", () => {
  const l = parseShape({ ...line, rows: ["...#...", ".#.#.#.", ".#.#.#."] });
  assert.deepEqual(
    l.slots.map((s) => [s.direction, s.cells]),
    [
      ["across", [0, 1, 2]],
      ["across", [4, 5, 6]],
      ["down", [0, 7, 14]],
      ["down", [2, 9, 16]],
      ["down", [4, 11, 18]],
      ["down", [6, 13, 20]],
    ],
  );
  assert.equal(l.intersections.length, 4);
  assert.deepEqual(l.intersections[0], {
    a: 0,
    b: 2,
    aOffset: 0,
    bOffset: 0,
    cell: 0,
  });
  const shortRuns = parseShape({ ...line, rows: ["..", "..", ".."] });
  assert.equal(shortRuns.slots.length, 2);
  assert.ok(shortRuns.slots.every((s) => s.direction === "down"));
});
test("normalizes structured grid_entry without inventing forms; rejects duplicates and punctuation", () => {
  assert.deepEqual(parseWords(list([" pea ", "oak"])).entries, ["OAK", "PEA"]);
  for (const entries of [
    ["PEA", "pea"],
    ["sea-bass"],
    ["café"],
    ["straße"],
    ["ſea"],
    ["two words"],
    [""],
  ])
    assert.throws(() => parseWords(list(entries)));
});
test("solver enforces crossings, seeds, exact length and all-different words", () => {
  const layout = parseShape({ ...line, rows: ["...#..."] });
  assert.equal(solve(layout, ["OAK"]).length, 0, "cannot repeat OAK");
  assert.equal(solve(parseShape(line), ["KALE"]).length, 0);
  const result = generate(shape, words, "1");
  assert.equal(new Set(result.target.words).size, result.layout.slots.length);
  for (const slot of result.layout.slots)
    assert.ok(
      result.dictionary.entries.includes(
        slot.cells.map((c) => result.target.grid[c]).join(""),
      ),
    );
  assert.equal(
    solve(result.layout, result.dictionary.entries, { 0: "Z" }).length,
    0,
  );
  assert.throws(() => generate(line, list(["KALE"]), "1"), /No valid fill/);
});
test("solution counter stops at two and budget exhaustion fails explicitly", () => {
  const layout = parseShape(line);
  assert.equal(solve(layout, ["OAK", "PEA", "FIG", "ASH"]).length, 2);
  assert.equal(solve(layout, ["OAK", "PEA"], {}, { limit: 1 }).length, 1);
  assert.throws(
    () => solve(layout, ["OAK"], {}, { maxNodes: 1 }),
    /budget exceeded/,
  );
});
test("same seed generates identical puzzles; different seeds can choose different fills", () => {
  assert.deepEqual(generate(shape, words, "1"), generate(shape, words, "1"));
  const fills = new Set(
    Array.from({ length: 10 }, (_, i) =>
      canonicalGrid(shape.rows, generate(shape, words, String(i)).target.grid),
    ),
  );
  assert.ok(fills.size > 1);
});
test("ambiguity is reduced with target letters, final seeds are irredundant, fixed seeds retained", () => {
  const result = generate(shape, words, "1");
  assert.equal(solve(result.layout, result.dictionary.entries).length, 2);
  assert.ok(Object.keys(result.seeds).length > 0);
  assert.equal(
    solve(result.layout, result.dictionary.entries, result.seeds).length,
    1,
  );
  for (const key of Object.keys(result.seeds)) {
    const reduced = { ...result.seeds };
    delete reduced[key];
    assert.equal(
      solve(result.layout, result.dictionary.entries, reduced).length,
      2,
    );
  }
  const fixed = generate(
    { ...line, seeds: { 0: "O" } },
    list(["OAK", "PEA"]),
    "1",
  );
  assert.deepEqual(fixed.seeds, { 0: "O" });
  assert.equal(solve(fixed.layout, fixed.dictionary.entries).length, 1);
  assert.equal(
    solve(fixed.layout, fixed.dictionary.entries, { 0: "P" }).length,
    0,
  );
});
test("generated public demo independently has exactly one solution and a correct spoiler-light hash", async () => {
  const puzzle = parsePuzzle(read("public/puzzles/demo.json"));
  const answers = solve(
    parseShape(puzzle.shape),
    parseWords(words).entries,
    puzzle.seeds,
  );
  assert.equal(answers.length, 1);
  const grid = answers[0].grid;
  assert.equal(
    await hashGrid(puzzle.shape.rows, grid),
    createHash("sha256")
      .update(canonicalGrid(puzzle.shape.rows, grid))
      .digest("hex"),
  );
  assert.equal(await isComplete(puzzle, grid), true);
  assert.equal(await isComplete(puzzle, puzzle.seeds), false);
  const changed = { ...grid };
  const cell = parseShape(puzzle.shape).cells.find((c) => !puzzle.seeds[c])!;
  changed[cell] = grid[cell] === "Z" ? "A" : "Z";
  assert.equal(await isComplete(puzzle, changed), false);
  assert.equal("words" in puzzle, false);
  assert.equal("target" in puzzle, false);
  assert.equal("solution" in puzzle, false);
  const current = generate(shape, words, puzzle.seed);
  assert.deepEqual(puzzle.seeds, current.seeds);
  assert.equal(
    puzzle.validation.hash,
    await hashGrid(shape.rows, current.target.grid),
  );
});
test("canonical representation is ordered by cells and preserves separators", () => {
  assert.equal(
    canonicalGrid([".#."], { 2: "B", 0: "A" }),
    "lingosaic-grid-v1\nA#B",
  );
  assert.equal(canonicalGrid([".#."], { 0: "A" }), "lingosaic-grid-v1\nA#.");
});
test("timestamp timing survives reload and stops at completion; boundary formatting", () => {
  assert.equal(
    elapsedSeconds({ ...freshProgress(), startedAt: 1000 }, 65000),
    64,
  );
  assert.equal(
    elapsedSeconds(
      { ...freshProgress(), startedAt: 1000, finishedAt: 65000 },
      90000,
    ),
    64,
  );
  assert.deepEqual([59, 60, 384, 3599, 3600].map(formatTime), [
    "0:59",
    "1:00",
    "6:24",
    "59:59",
    "1:00:00",
  ]);
  assert.equal(nextCell(["...#..."], 2, 1, 0), 4);
  assert.equal(nextCell(["...#..."], 0, -1, 0), undefined);
});
test("restoration validates claimed completion and isolates progress by validator", async () => {
  const puzzle = parsePuzzle(read("public/puzzles/demo.json"));
  assert.deepEqual(await restoreProgress(puzzle, "{"), freshProgress());
  const forged = {
    version: 1,
    letters: { 1: "A", 999: "Z" },
    startedAt: 100,
    finishedAt: 200,
  };
  const restored = await restoreProgress(puzzle, JSON.stringify(forged), 300);
  assert.equal(restored.finishedAt, null);
  assert.equal(restored.letters[999], undefined);
  const solution = solve(
    parseShape(puzzle.shape),
    parseWords(words).entries,
    puzzle.seeds,
  )[0];
  const valid = await restoreProgress(
    puzzle,
    JSON.stringify({ ...forged, letters: solution.grid }),
    300,
  );
  assert.equal(valid.finishedAt, 200);
  assert.ok(Object.keys(puzzle.seeds).every((c) => !valid.letters[c]));
  assert.notEqual(
    storageKey(puzzle),
    storageKey({
      ...puzzle,
      validation: { ...puzzle.validation, hash: "other" },
    }),
  );
});
