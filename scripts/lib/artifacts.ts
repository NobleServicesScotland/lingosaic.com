import {
  canonicalGrid,
  GENERATOR_VERSION,
  generate,
  hashGrid,
  solve,
  type Puzzle,
} from "../../src/lib/puzzle.js";

export interface ArtifactPaths {
  public: string;
  solution: string;
  report: string;
}
export function artifactPaths(id: string, publicPath: string): ArtifactPaths {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
    throw new Error(
      "Puzzle id must use letters, digits, underscores or hyphens (start with a letter or digit)",
    );
  return {
    public: publicPath,
    solution: `private/solutions/${id}.solution.json`,
    report: `private/reports/${id}.report.json`,
  };
}
// Node-only QA assembly. Reuses the existing generator result; does not change solving.
export async function createArtifacts(
  result: ReturnType<typeof generate>,
  id: string,
  seed: string,
  paths: ArtifactPaths,
) {
  const { layout, dictionary, target, seeds } = result;
  const verified = solve(layout, dictionary.entries, seeds);
  if (
    verified.length !== 1 ||
    canonicalGrid(layout.shape.rows, verified[0].grid) !==
      canonicalGrid(layout.shape.rows, target.grid)
  )
    throw new Error(
      "QA failed: published constraints do not uniquely identify the target",
    );
  const puzzle: Puzzle = {
    schema_version: 1,
    id,
    generator_version: GENERATOR_VERSION,
    seed,
    theme: dictionary.source.theme,
    shape: layout.shape,
    seeds,
    validation: {
      algorithm: "SHA-256",
      canonical_version: 1,
      hash: await hashGrid(layout.shape.rows, target.grid),
    },
  };
  const coordinate = (cell: number) => ({
    row: Math.floor(cell / layout.width),
    column: cell % layout.width,
  });
  const solution = {
    schema_version: 1,
    puzzle_id: id,
    shape_id: layout.shape.id,
    theme: dictionary.source.theme,
    generator_seed: seed,
    generator_version: GENERATOR_VERSION,
    shape: layout.shape,
    width: layout.width,
    height: layout.height,
    solved_grid: target.grid,
    solved_rows: canonicalGrid(layout.shape.rows, target.grid)
      .split("\n")
      .slice(1),
    slots: layout.slots.map((slot) => ({
      ...slot,
      start: coordinate(slot.cells[0]),
      coordinates: slot.cells.map(coordinate),
      length: slot.cells.length,
      answer: target.words[slot.id],
      candidates_before_crossings: dictionary.entries.filter(
        (word) => word.length === slot.cells.length,
      ).length,
    })),
    crossings: layout.intersections.map((crossing) => ({
      ...crossing,
      coordinate: coordinate(crossing.cell),
      letter: target.grid[crossing.cell],
    })),
    input_seeds: layout.shape.seeds ?? {},
    seeds,
    uniqueness_count: verified.length,
    dictionary: {
      theme: dictionary.source.theme,
      words: dictionary.source.words,
      entries: dictionary.entries,
    },
  };
  const report = {
    schema_version: 1,
    puzzle_id: id,
    shape_id: layout.shape.id,
    generator_seed: seed,
    generator_version: GENERATOR_VERSION,
    dictionary_size: dictionary.entries.length,
    slot_count: layout.slots.length,
    revealed_seed_count: Object.keys(seeds).length,
    search_result: "complete",
    uniqueness_count: verified.length,
    completion_hash: puzzle.validation.hash,
    outputs: paths,
  };
  return { puzzle, solution, report };
}
export type PrivateSolution = Awaited<
  ReturnType<typeof createArtifacts>
>["solution"];
export type GenerationReport = Awaited<
  ReturnType<typeof createArtifacts>
>["report"];
