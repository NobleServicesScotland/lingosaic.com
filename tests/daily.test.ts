import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseWords,
  parseShape,
  solve,
  isComplete,
} from "../src/lib/puzzle.js";
import {
  appBaseUrl,
  applyHint,
  correctLetter,
  exampleGrid,
  hintTarget,
  letterHash,
  parseDailyPuzzle,
  previousDate,
  selectDate,
  type CatalogEntry,
} from "../src/lib/daily.js";
import {
  freshDailyProgress,
  restoreDailyProgress,
  dailyStorageKey,
} from "../src/lib/daily-progress.js";
import { elapsedSeconds, formatTime } from "../src/lib/player.js";
import {
  clipboardText,
  createResultSharePayload,
  createPuzzleSharePayload,
  puzzleUrl,
  shareResult,
  socialLinks,
  isPrivateShareUrl,
} from "../src/lib/sharing.js";
import { renderInspector } from "../scripts/lib/inspector.js";
const root = new URL("..", import.meta.url);
const read = async (path: string) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const puzzle = () =>
  read("public/puzzles/2026-10-03.json").then(parseDailyPuzzle);
test("all 121 supplied daily fills remain uniquely solvable, hash-correct and spoiler-light after import", async () => {
  const catalog: CatalogEntry[] = await read("public/puzzles/index.json");
  assert.equal(catalog.length, 121);
  assert.equal(catalog[0].date, "2026-10-03");
  assert.equal(catalog.at(-1)?.date, "2027-01-31");
  for (const entry of catalog) {
    const p = parseDailyPuzzle(await read(`public/puzzles/${entry.date}.json`));
    const solution = await read(`private/solutions/${p.id}.solution.json`);
    const source = await read(
      `puzzles/lingosaic-daily-dense-2026-10-03_to_2027-01-31/puzzles/${entry.date}.puzzle.json`,
    );
    const dictionary = parseWords(
      await read(
        `puzzles/lingosaic-daily-dense-2026-10-03_to_2027-01-31/${source.dictionary.file.replace("../", "")}`,
      ),
    );
    const layout = parseShape(p.shape);
    assert.equal(source.schema_version, 2);
    assert.equal(dictionary.entries.length, 100);
    assert.equal(layout.slots.length, source.complexity.slot_count);
    assert.equal(layout.intersections.length, source.complexity.crossings);
    assert.ok(layout.slots.length >= 12 && layout.slots.length <= 18);
    assert.equal(p.generator_version, source.generator.version);
    assert.equal(p.daily_number, catalog.indexOf(entry) + 1);
    for (const slot of layout.slots)
      assert.ok(
        slot.cells.some((cell) => p.seeds[cell]),
        `${p.date}: slot ${slot.id} has a helping letter`,
      );
    for (const seed of source.grid.seed_letters)
      assert.equal(p.seeds[seed.row * layout.width + seed.col], seed.letter);
    assert.deepEqual(solution.seeds, p.seeds);
    const counted = solve(layout, dictionary.entries, p.seeds);
    assert.equal(counted.length, 1, p.date);
    assert.deepEqual(counted[0].grid, solution.solved_grid);
    assert.equal(await isComplete(p, solution.solved_grid), true);
    assert.equal(await isComplete(p, p.seeds), false);
    assert.equal(
      p.silhouette.some((row) => row.includes(".")),
      true,
    );
    assert.ok(
      p.silhouette.some((row, y) =>
        [...row].some((c, x) => c === "." && p.shape.rows[y][x] === "#"),
      ),
    );
    for (const cell of layout.cells)
      assert.equal(
        letterHash(p.id, cell, solution.solved_grid[cell]),
        p.cell_hashes[cell],
      );
    for (const field of [
      "solution",
      "solved_grid",
      "solved_rows",
      "slots",
      "words",
      "dictionary",
    ])
      assert.equal(field in p, false);
  }
});
test("hints require Start, reveal whole words, persist and stop after three", async () => {
  const p = await puzzle();
  let state = freshDailyProgress();
  assert.equal(hintTarget(p, state), undefined);
  assert.deepEqual(applyHint(p, state), state);
  state = { ...state, startedAt: 100 };
  for (let i = 0; i < 3; i++) {
    const slot = hintTarget(p, state)!;
    state = applyHint(p, state);
    assert.equal(state.hintsUsed, i + 1);
    for (const cell of slot.cells) {
      assert.equal(
        p.seeds[cell] ?? state.letters[cell],
        correctLetter(p, cell),
      );
      if (!p.seeds[cell]) assert.ok(state.hintCells.includes(cell));
    }
  }
  assert.equal(hintTarget(p, state), undefined);
  assert.deepEqual(applyHint(p, state), state);
  assert.deepEqual(
    await restoreDailyProgress(p, JSON.stringify(state), 200),
    state,
  );
  const solved = { ...state, letters: await exampleGrid(p), finishedAt: 200 };
  const restored = await restoreDailyProgress(p, JSON.stringify(solved), 900);
  assert.equal(restored.finishedAt, 200);
  assert.equal(restored.hintsUsed, 3);
  assert.ok(restored.hintCells.length > 3);
  const legacyCell = parseShape(p.shape).cells.find((cell) => !p.seeds[cell])!;
  const legacy = {
    version: 1,
    startedAt: 100,
    finishedAt: null,
    letters: { [legacyCell]: correctLetter(p, legacyCell) },
    hintCells: [legacyCell],
  };
  assert.equal(
    (await restoreDailyProgress(p, JSON.stringify(legacy), 200)).hintsUsed,
    1,
  );
  assert.equal(elapsedSeconds(restored, 10000), 0);
  assert.notEqual(dailyStorageKey(p), dailyStorageKey({ ...p, id: "other" }));
});
test("date selection respects production release dates; examples use actual previous calendar day", () => {
  const entries = [
    { id: "one", date: "2026-10-03", theme: "A" },
    { id: "two", date: "2026-10-04", theme: "B" },
  ];
  assert.equal(selectDate(entries, "2026-10-02", false), undefined);
  assert.equal(selectDate(entries, "2026-10-02", true), "2026-10-03");
  assert.equal(selectDate(entries, "2026-10-02", false, "two"), undefined);
  assert.equal(selectDate(entries, "2026-10-04", false, "one"), "2026-10-03");
  assert.equal(
    selectDate(entries, "2026-10-04", true, "2026-10-03"),
    "2026-10-03",
  );
  assert.equal(selectDate(entries, "2026-10-03", false, "two"), undefined);
  assert.equal(selectDate(entries, "2026-10-04", false, "missing"), undefined);
  assert.equal(previousDate("2026-11-01"), "2026-10-31");
});
test("permanent share URLs retain base paths; result payload has real timing, plural hints and no answers", async () => {
  const p = await puzzle();
  const base = appBaseUrl({
    origin: "https://example.test",
    pathname: "/site/puzzle/daily-2026-10-03/",
  });
  assert.equal(base.href, "https://example.test/site/");
  assert.equal(
    puzzleUrl(p.id, base),
    "https://example.test/site/puzzle/daily-2026-10-03/",
  );
  assert.equal(
    appBaseUrl({
      origin: "https://example.test",
      pathname: "/site/puzzle/daily-2026-10-03/index.html",
    }).href,
    base.href,
  );
  const solution = await read(`private/solutions/${p.id}.solution.json`);
  for (const count of [0, 1, 2, 3]) {
    const state = {
      ...freshDailyProgress(),
      startedAt: 1000,
      finishedAt: 385000,
      hintCells: [1, 2, 3].slice(0, count),
      hintsUsed: count,
    };
    const payload = createResultSharePayload(p, state, base);
    assert.ok(payload.text.includes("Solved in 6:24"));
    assert.ok(
      payload.text.includes(
        count === 0
          ? "✨ No hints"
          : `${count} ${count === 1 ? "hint" : "hints"}`,
      ),
    );
    assert.ok(!payload.text.includes(payload.url));
    assert.equal(clipboardText(payload).split(payload.url).length, 2);
    for (const slot of solution.slots)
      assert.ok(!payload.text.includes(slot.answer));
    assert.ok(payload.text.includes("daily silhouette word puzzle"));
    assert.ok(
      payload.text.startsWith("Lingosaic is a daily silhouette word puzzle"),
    );
    assert.ok(payload.text.includes(`I solved #${p.daily_number}`));
    assert.ok(payload.text.includes("Your turn! Can you beat my time?"));
    const links = socialLinks(payload);
    assert.equal(new URL(links.x).searchParams.get("url"), payload.url);
    assert.equal(
      new URL(links.whatsapp).searchParams.get("text"),
      clipboardText(payload),
    );
  }
  const challenge = createPuzzleSharePayload(p, base);
  assert.equal(challenge.url, puzzleUrl(p.id, base));
  assert.ok(challenge.text.includes("Can you solve it?"));
  assert.ok(!challenge.text.includes("Solved in"));
  for (const slot of solution.slots)
    assert.ok(!challenge.text.includes(slot.answer));
  assert.throws(
    () => createResultSharePayload(p, freshDailyProgress(), base),
    /completed/,
  );
  assert.deepEqual([59, 60, 3599, 3600].map(formatTime), [
    "0:59",
    "1:00",
    "59:59",
    "1:00:00",
  ]);
});
test("native share keeps URL separate and native cancellation is normal", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let received: unknown;
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        share: async (payload: unknown) => {
          received = payload;
        },
      },
    });
    const payload = {
      title: "Daily Lingosaic",
      text: "Spoiler-free result",
      url: "https://example.test/puzzle/daily-2026-10-03/",
    };
    assert.equal(await shareResult(payload), "shared");
    assert.deepEqual(received, payload);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        share: async () => {
          throw Object.assign(new Error("Cancelled"), { name: "AbortError" });
        },
      },
    });
    assert.equal(await shareResult(payload), "cancelled");
    let copied = "";
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copied = text;
          },
        },
      },
    });
    assert.equal(await shareResult(payload), "copied");
    assert.equal(copied, clipboardText(payload));
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        share: async () => {
          throw new Error("Unavailable");
        },
        clipboard: {
          writeText: async (text: string) => {
            copied = text;
          },
        },
      },
    });
    assert.equal(await shareResult(payload), "copied");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
test("inspector browses first and last daily solutions using the shared view without invented timing", async () => {
  const html = await renderInspector(
    new URL("..", import.meta.url).pathname,
    "2026-10-03",
  );
  assert.ok(html.includes("1 / 121"));
  assert.ok(html.includes("Next →"));
  assert.ok(html.includes("Solution preview"));
  assert.ok(!html.includes("Solved in"));
  const last = await renderInspector(
    new URL("..", import.meta.url).pathname,
    "2027-01-31",
  );
  assert.ok(last.includes("121 / 121"));
  assert.ok(last.includes("Previous"));
  await assert.rejects(
    () =>
      renderInspector(new URL("..", import.meta.url).pathname, "2026-01-01"),
    /Unknown/,
  );
});

test("private development share URLs are distinguished from public puzzle URLs", () => {
  for (const host of [
    "192.168.0.2",
    "127.0.0.1",
    "localhost",
    "10.0.0.2",
    "172.16.0.1",
    "172.31.255.255",
    "[::1]",
    "[fd00::1]",
  ])
    assert.equal(isPrivateShareUrl(`http://${host}:5173/puzzle/demo/`), true);
  for (const host of [
    "lingosaic.com",
    "example.test",
    "172.15.0.1",
    "172.32.0.1",
    "192.169.1.1",
  ])
    assert.equal(isPrivateShareUrl(`https://${host}/puzzle/demo/`), false);
});
