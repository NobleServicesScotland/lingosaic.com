import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { get } from "node:http";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isComplete,
  parsePuzzle,
  parseShape,
  parseWords,
  solve,
} from "../src/lib/puzzle.js";
import { checkPublicBuild } from "../scripts/lib/public-build.js";
import {
  startInspector,
  INSPECTOR_HOST,
  inspectorHosts,
} from "../scripts/lib/inspector.js";
import type {
  PrivateSolution,
  GenerationReport,
} from "../scripts/lib/artifacts.js";
const repository = fileURLToPath(new URL("..", import.meta.url));
const execute = promisify(execFile);
let root: string;
const read = async (path: string) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
const generateDemo = async () =>
  execute(
    process.execPath,
    [
      resolve(repository, "node_modules/tsx/dist/cli.mjs"),
      resolve(repository, "scripts/generate-puzzle.ts"),
      "--shape",
      resolve(repository, "data/shapes/demo.grid.json"),
      "--words",
      resolve(repository, "data/wordlists/demo.word-list.json"),
      "--seed",
      "1",
      "--id",
      "demo",
      "--out",
      "public/puzzles/demo.json",
    ],
    { cwd: root },
  );
before(async () => {
  root = await mkdtemp(join(tmpdir(), "lingosaic-qa-"));
  await generateDemo();
});
after(async () => {
  await rm(root, { recursive: true, force: true });
});
test("real CLI writes deterministic private solution/report and unchanged public format", async () => {
  const paths = [
    "public/puzzles/demo.json",
    "private/solutions/demo.solution.json",
    "private/reports/demo.report.json",
  ];
  const initial = await Promise.all(
    paths.map((path) => readFile(join(root, path), "utf8")),
  );
  await generateDemo();
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(join(root, path), "utf8"))),
    initial,
  );
  assert.deepEqual(
    await read(paths[0]),
    JSON.parse(await readFile(resolve(repository, paths[0]), "utf8")),
  );
  const report: GenerationReport = await read(paths[2]);
  assert.equal(report.uniqueness_count, 1);
  assert.equal(report.search_result, "complete");
});
test("private answers, coordinates, crossings, seeds and public hash agree with approved dictionary", async () => {
  const solution: PrivateSolution = await read(
    "private/solutions/demo.solution.json",
  );
  const puzzle = parsePuzzle(await read("public/puzzles/demo.json"));
  const dictionary = parseWords({ schema_version: 1, ...solution.dictionary });
  const layout = parseShape(puzzle.shape);
  assert.equal(solution.puzzle_id, puzzle.id);
  assert.equal(solution.shape_id, puzzle.shape.id);
  assert.equal(solution.generator_seed, puzzle.seed);
  assert.equal(solution.generator_version, puzzle.generator_version);
  assert.deepEqual(solution.seeds, puzzle.seeds);
  assert.deepEqual(
    solution.slots.map((slot) => slot.cells),
    layout.slots.map((slot) => slot.cells),
  );
  assert.equal(
    new Set(solution.slots.map((slot) => slot.answer)).size,
    layout.slots.length,
  );
  for (const slot of solution.slots) {
    assert.ok(dictionary.entries.includes(slot.answer));
    assert.equal(
      slot.answer,
      slot.cells.map((c) => solution.solved_grid[c]).join(""),
    );
    assert.equal(slot.length, slot.cells.length);
    assert.deepEqual(
      slot.coordinates,
      slot.cells.map((cell) => ({
        row: Math.floor(cell / layout.width),
        column: cell % layout.width,
      })),
    );
    assert.equal(
      slot.candidates_before_crossings,
      dictionary.entries.filter((w) => w.length === slot.length).length,
    );
  }
  for (const c of solution.crossings) {
    assert.equal(solution.slots[c.a].answer[c.aOffset], c.letter);
    assert.equal(solution.slots[c.b].answer[c.bOffset], c.letter);
    assert.equal(c.letter, solution.solved_grid[c.cell]);
  }
  assert.equal(await isComplete(puzzle, solution.solved_grid), true);
  const counted = solve(layout, dictionary.entries, puzzle.seeds);
  assert.equal(counted.length, 1);
  assert.deepEqual(counted[0].grid, solution.solved_grid);
  const publicText = JSON.stringify(puzzle);
  for (const slot of solution.slots)
    assert.ok(!publicText.includes(slot.answer));
  assert.deepEqual(
    Object.keys(puzzle).sort(),
    [
      "schema_version",
      "id",
      "generator_version",
      "seed",
      "theme",
      "shape",
      "seeds",
      "validation",
    ].sort(),
  );
});
test("inspector binds to network interfaces, renders a solved view and rejects arbitrary files/rebinding hosts", async () => {
  const server = await startInspector(root, 0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    assert.equal(address.address, INSPECTOR_HOST);
    assert.equal(address.address, "0.0.0.0");
    const url = `http://127.0.0.1:${address.port}`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes("Solution preview"));
    assert.ok(html.includes("Browse solved puzzles"));
    assert.ok(html.includes("silhouette-grid"));
    assert.ok(!html.includes("<h2>Dictionary</h2>"));
    assert.equal(
      (await fetch(`${url}/private/solutions/demo.solution.json`)).status,
      404,
    );
    const rebindingStatus = await new Promise<number | undefined>(
      (resolve, reject) => {
        get(url, { headers: { Host: "example.com" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        }).on("error", reject);
      },
    );
    assert.equal(rebindingStatus, 403);
    for (const host of inspectorHosts()) {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          get(
            url,
            { headers: { Host: `${host}:${address.port}` } },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          ).on("error", reject);
        },
      );
      assert.equal(status, 200);
    }
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("public build audit rejects copied private files, plaintext answers, inspector UI and URL", async () => {
  const auditRoot = await mkdtemp(join(tmpdir(), "lingosaic-audit-"));
  try {
    await mkdir(join(auditRoot, "dist"), { recursive: true });
    await cp(join(root, "private"), join(auditRoot, "private"), {
      recursive: true,
    });
    const output = join(auditRoot, "dist/index.html");
    await writeFile(output, "<!doctype html><h1>Lingosaic</h1>");
    assert.equal(await checkPublicBuild(auditRoot), 1);
    const artifact = await readFile(
      join(root, "private/solutions/demo.solution.json"),
      "utf8",
    );
    const solution: PrivateSolution = JSON.parse(artifact);
    for (const bad of [
      artifact,
      JSON.stringify(JSON.parse(artifact)),
      solution.slots[0].answer,
      "http://127.0.0.1:5174/",
      "Developer inspector ↗",
      "Solve puzzle",
    ]) {
      await writeFile(output, bad);
      await assert.rejects(() => checkPublicBuild(auditRoot));
    }
    await writeFile(output, "<!doctype html>Lingosaic");
    await mkdir(join(auditRoot, "dist/private"), { recursive: true });
    await writeFile(join(auditRoot, "dist/private/leak.txt"), "private");
    await assert.rejects(
      () => checkPublicBuild(auditRoot),
      /Private file path/,
    );
  } finally {
    await rm(auditRoot, { recursive: true, force: true });
  }
});

test("production audit distinguishes React DOM tag branches and published themes from standalone answers", async () => {
  const auditRoot = await mkdtemp(join(tmpdir(), "lingosaic-tag-audit-"));
  try {
    await mkdir(join(auditRoot, "private/solutions"), { recursive: true });
    await mkdir(join(auditRoot, "dist/puzzles"), { recursive: true });
    await writeFile(
      join(auditRoot, "private/solutions/tags.json"),
      JSON.stringify({ slots: [{ answer: "SCRIPT" }, { answer: "STEM" }] }),
    );
    const output = join(auditRoot, "dist/app.js");
    await writeFile(
      output,
      'f==="SCRIPT"||f==="STYLE";case"SCRIPT":case"STYLE":continue;case"LINK"',
    );
    assert.equal(await checkPublicBuild(auditRoot), 1);
    await writeFile(output, 'const leaked="SCRIPT";');
    await assert.rejects(() => checkPublicBuild(auditRoot), /Plaintext answer/);
    await writeFile(output, 'const app="Lingosaic";');
    await writeFile(
      join(auditRoot, "dist/puzzles/index.json"),
      JSON.stringify([
        {
          id: "daily-2026-11-08",
          date: "2026-11-08",
          theme: "STEM & inventions",
        },
      ]),
    );
    await writeFile(
      join(auditRoot, "dist/index.html"),
      "<title>STEM &amp; inventions</title>",
    );
    assert.equal(await checkPublicBuild(auditRoot), 3);
    await writeFile(join(auditRoot, "dist/index.html"), "<p>STEM</p>");
    await assert.rejects(() => checkPublicBuild(auditRoot), /Plaintext answer/);
  } finally {
    await rm(auditRoot, { recursive: true, force: true });
  }
});
