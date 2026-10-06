import test from "node:test";
import assert from "node:assert/strict";
import { parseShape } from "../src/lib/puzzle.js";
import { addHelpingSeeds } from "../scripts/lib/helping-seeds.js";
const shape = (rows: string[]) =>
  parseShape({ schema_version: 1, id: "test", name: "Test", rows });
test("a shared crossing provides a helping letter to both words deterministically", () => {
  const layout = shape(["#.#", "...", "#.#"]);
  const grid = { 1: "B", 3: "C", 4: "A", 5: "T", 7: "R" };
  assert.deepEqual(addHelpingSeeds(layout, grid, {}), { 4: "A" });
  assert.deepEqual(
    addHelpingSeeds(layout, grid, {}),
    addHelpingSeeds(layout, grid, {}),
  );
  assert.deepEqual(addHelpingSeeds(layout, grid, { 4: "A" }), { 4: "A" });
  assert.deepEqual(addHelpingSeeds(layout, grid, { 1: "B" }), {
    1: "B",
    4: "A",
  });
  assert.throws(
    () => addHelpingSeeds(layout, grid, { 1: "Z" }),
    /does not match/,
  );
});
test("uncrossed words receive letters and previously seeded words receive no unnecessary additions", () => {
  const layout = shape(["...#..."]);
  const grid = { 0: "C", 1: "A", 2: "T", 4: "D", 5: "O", 6: "G" };
  assert.deepEqual(addHelpingSeeds(layout, grid, {}), { 0: "C", 4: "D" });
  assert.deepEqual(addHelpingSeeds(layout, grid, { 1: "A", 5: "O" }), {
    1: "A",
    5: "O",
  });
});
