import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { parseShape, parseWords, solve } from "../src/lib/puzzle.js";
import {
  letterHash,
  parseDailyPuzzle,
  type CatalogEntry,
} from "../src/lib/daily.js";
import { addHelpingSeeds } from "./lib/helping-seeds.js";
import { artifactPaths, createArtifacts } from "./lib/artifacts.js";
export const DAILY_PACK =
  "puzzles/lingosaic-daily-dense-2026-10-03_to_2027-01-31";
const root = resolve(DAILY_PACK);
async function read(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function write(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}
async function main() {
  const manifest = await read(resolve(root, "manifest.json"));
  const { from, to, count: expectedCount } = manifest.period;
  const first = Date.parse(`${from}T00:00:00Z`);
  const last = Date.parse(`${to}T00:00:00Z`);
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    !Number.isInteger(expectedCount) ||
    expectedCount < 1 ||
    (last - first) / 86400000 + 1 !== expectedCount
  )
    throw new Error("Invalid daily pack period");
  const pending: {
    paths: ReturnType<typeof artifactPaths>;
    puzzle: unknown;
    solution: unknown;
    report: unknown;
  }[] = [];
  const catalog: CatalogEntry[] = [];
  for (const name of (await readdir(resolve(root, "puzzles")))
    .filter((name) => name.endsWith(".puzzle.json"))
    .sort()) {
    const source = await read(resolve(root, "puzzles", name));
    if (
      ![1, 2].includes(source.schema_version) ||
      source.date !== name.replace(".puzzle.json", "")
    )
      throw new Error(`${name}: unsupported puzzle schema or date mismatch`);
    if (
      source.daily_number !==
      (Date.parse(`${source.date}T00:00:00Z`) - first) / 86400000 + 1
    )
      throw new Error(`${source.date}: invalid daily number`);
    const fixedLetter = source.schema_version === 2 ? /^[A-Z]$/ : /^[A-WYZ]$/;
    if (
      source.grid.rows.some(
        (row: string) =>
          !(source.schema_version === 2 ? /^[#*.A-Z]+$/ : /^[#.A-Z]+$/).test(
            row,
          ),
      )
    )
      throw new Error(`${source.date}: invalid source mask`);
    const solution = await read(
      resolve(root, "solutions", `${source.date}.solution.json`),
    );
    const dictionary = parseWords(
      await read(resolve(root, "puzzles", source.dictionary.file)),
    );
    const seedCells = Object.fromEntries(
      source.grid.seed_letters.map(
        (s: { row: number; col: number; letter: string }) => [
          s.row * source.grid.width + s.col,
          s.letter,
        ],
      ),
    );
    source.grid.rows.forEach((row: string, y: number) =>
      [...row].forEach((letter, x) => {
        if (
          fixedLetter.test(letter) &&
          seedCells[y * source.grid.width + x] !== letter
        )
          throw new Error(
            `${source.date}: fixed grid letter is missing or inconsistent in seed list`,
          );
      }),
    );
    const rows: string[] = source.grid.rows.map((row: string, y: number) =>
      [...row]
        .map((c, x) =>
          c === "." ||
          seedCells[y * source.grid.width + x] ||
          fixedLetter.test(c)
            ? "."
            : "#",
        )
        .join(""),
    );
    const layout = parseShape({
      schema_version: 1,
      id: source.shape.id,
      name: source.shape.name,
      rows,
      seeds: seedCells,
    });
    if (
      layout.width !== source.grid.width ||
      layout.height !== source.grid.height
    )
      throw new Error("Dimension mismatch");
    const grid = Object.fromEntries(
      layout.cells.map((cell) => [
        cell,
        solution.solution_grid[Math.floor(cell / layout.width)][
          cell % layout.width
        ],
      ]),
    );
    const words = layout.slots.map((slot) =>
      slot.cells.map((cell) => grid[cell]).join(""),
    );
    if (
      new Set(words).size !== words.length ||
      words.some((word) => !dictionary.entries.includes(word))
    )
      throw new Error(`${source.date}: unapproved or repeated answer`);
    const extracted = layout.slots
      .map((s) => `${s.direction}:${s.cells.join(",")}`)
      .sort();
    const declared = source.slots
      .map(
        (s: { direction: string; cells: { row: number; col: number }[] }) =>
          `${s.direction}:${s.cells.map((c) => c.row * layout.width + c.col).join(",")}`,
      )
      .sort();
    if (JSON.stringify(extracted) !== JSON.stringify(declared))
      throw new Error(
        `${source.date}: declared slots do not match maximal runs`,
      );
    const canonical = layout.cells.map((cell) => grid[cell]).join("");
    if (
      createHash("sha256").update(canonical).digest("hex") !==
        source.completion.solution_hash ||
      canonical !== solution.canonical_solution
    )
      throw new Error(`${source.date}: source hash mismatch`);
    const count = solve(layout, dictionary.entries, seedCells);
    if (
      count.length !== 1 ||
      layout.cells.some((cell) => count[0].grid[cell] !== grid[cell])
    )
      throw new Error(`${source.date}: supplied fill is not uniquely solvable`);
    const paths = artifactPaths(
      source.puzzle_id,
      `public/puzzles/${source.date}.json`,
    );
    const helpingSeeds = addHelpingSeeds(layout, grid, seedCells);
    const artifacts = await createArtifacts(
      { layout, dictionary, target: { grid, words }, seeds: helpingSeeds },
      source.puzzle_id,
      source.generator.seed,
      paths,
    );
    // Preserve the supplied fill's provenance; this tool validates/imports it.
    artifacts.puzzle.generator_version = source.generator.version;
    artifacts.solution.generator_version = source.generator.version;
    artifacts.report.generator_version = source.generator.version;
    const puzzle = parseDailyPuzzle({
      ...artifacts.puzzle,
      date: source.date,
      daily_number: source.daily_number,
      description: source.bonus?.description ?? dictionary.source.theme.name,
      silhouette: source.grid.rows.map((row: string) =>
        [...row].map((c) => (c === "#" ? "#" : ".")).join(""),
      ),
      cell_hashes: Object.fromEntries(
        layout.cells.map((cell) => [
          cell,
          letterHash(source.puzzle_id, cell, grid[cell]),
        ]),
      ),
    });
    pending.push({
      paths,
      puzzle,
      solution: artifacts.solution,
      report: {
        ...artifacts.report,
        helping_seed_policy: "every-slot-crossings-first-v1",
        added_helping_seed_count:
          Object.keys(helpingSeeds).length - Object.keys(seedCells).length,
      },
    });
    catalog.push({
      id: puzzle.id,
      date: puzzle.date,
      theme: puzzle.theme.name,
    });
  }
  if (
    catalog.length !== expectedCount ||
    catalog[0]?.date !== from ||
    catalog.at(-1)?.date !== to
  )
    throw new Error(
      `Daily pack must cover all ${expectedCount} dates from ${from} to ${to}`,
    );
  if (
    new Set(catalog.map((entry) => entry.id)).size !== catalog.length ||
    catalog.some(
      (entry, index) =>
        entry.date !==
        new Date(first + index * 86400000).toISOString().slice(0, 10),
    )
  )
    throw new Error(
      "Daily calendar must be consecutive with unique puzzle ids",
    );
  // Verify the entire pack before replacing published files; a bad input must not
  // leave a partly imported calendar. Keep source packs and the generic demo intact.
  let previous: CatalogEntry[] = [];
  try {
    previous = await read("public/puzzles/index.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    !Array.isArray(previous) ||
    previous.some(
      (old) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(old.date) ||
        !/^daily-\d{4}-\d{2}-\d{2}$/.test(old.id),
    )
  )
    throw new Error("Invalid previous calendar record");
  for (const item of pending) {
    await write(item.paths.public, item.puzzle);
    await write(item.paths.solution, item.solution);
    await write(item.paths.report, item.report);
  }
  await write("public/puzzles/index.json", catalog);
  for (const old of previous) {
    const stale = [];
    if (!catalog.some((entry) => entry.date === old.date))
      stale.push(`public/puzzles/${old.date}.json`);
    if (!catalog.some((entry) => entry.id === old.id))
      stale.push(
        `private/solutions/${old.id}.solution.json`,
        `private/reports/${old.id}.report.json`,
      );
    for (const path of stale)
      await unlink(path).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
  }

  console.log(
    `Imported and independently verified ${catalog.length} daily puzzles; every supplied fill has exactly one solution.`,
  );
}
main().catch((error) => {
  console.error(`Daily import failed: ${error.message}`);
  process.exitCode = 1;
});
