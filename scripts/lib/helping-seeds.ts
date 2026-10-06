import type { Layout } from "../../src/lib/puzzle.js";

// Add fixed starting letters without changing the supplied fill or its existing seeds.
// Cover two unseeded slots at once where possible, then prefer a crossing over
// a non-crossing cell. Row-major order resolves ties deterministically.
export function addHelpingSeeds(
  layout: Layout,
  grid: Record<string, string>,
  original: Record<string, string>,
): Record<string, string> {
  const seeds = { ...original };
  for (const [cell, letter] of Object.entries(original)) {
    if (!layout.cells.includes(Number(cell)) || letter !== grid[cell])
      throw new Error("Starting seed does not match the supplied solution");
  }
  const crossingCells = new Set(layout.intersections.map((item) => item.cell));
  while (true) {
    const uncovered = layout.slots.filter(
      (slot) => !slot.cells.some((cell) => seeds[cell]),
    );
    if (!uncovered.length) return seeds;
    const candidates = layout.cells
      .filter((cell) => !seeds[cell])
      .map((cell) => ({
        cell,
        coverage: uncovered.filter((slot) => slot.cells.includes(cell)).length,
        crossing: crossingCells.has(cell) ? 1 : 0,
      }))
      .filter((item) => item.coverage > 0)
      .sort(
        (a, b) =>
          b.coverage - a.coverage || b.crossing - a.crossing || a.cell - b.cell,
      );
    const cell = candidates[0]?.cell;
    if (cell === undefined || !/^[A-Z]$/.test(grid[cell] ?? ""))
      throw new Error("Cannot supply a helping letter for every word slot");
    seeds[cell] = grid[cell];
  }
}
