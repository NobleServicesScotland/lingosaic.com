import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareControls } from "../src/components/ShareControls.js";
import { parseDailyPuzzle } from "../src/lib/daily.js";
import { freshDailyProgress } from "../src/lib/daily-progress.js";
import { copyText, createResultSharePayload } from "../src/lib/sharing.js";

test("sharing appears only after completion and includes only platforms that prefill result text", async () => {
  const puzzle = parseDailyPuzzle(
    JSON.parse(await readFile("public/puzzles/2026-10-03.json", "utf8")),
  );
  const base = new URL("https://example.test/site/");
  const challenge = renderToStaticMarkup(
    createElement(ShareControls, { puzzle, base }),
  );
  assert.equal(challenge, "");
  assert.equal(
    renderToStaticMarkup(
      createElement(ShareControls, {
        puzzle,
        base,
        progress: freshDailyProgress(),
      }),
    ),
    "",
  );
  const progress = {
    ...freshDailyProgress(),
    startedAt: 1000,
    finishedAt: 385000,
    hintsUsed: 1,
  };
  const html = renderToStaticMarkup(
    createElement(ShareControls, { puzzle, progress, base }),
  );
  assert.ok(html.includes("Solved in 6:24"));
  assert.ok(html.includes("1 hint"));
  assert.ok(html.includes('src="https://example.test/site/favicon.svg"'));
  assert.ok(html.includes("Copy my result and puzzle link"));
  assert.ok(html.includes("WhatsApp"));
  assert.ok(html.includes("Twitter"));
  assert.ok(!html.includes("Facebook"));
  assert.ok(!html.includes("LinkedIn"));
  assert.ok(!html.includes("Copy puzzle link for share"));
  const solution = JSON.parse(
    await readFile(`private/solutions/${puzzle.id}.solution.json`, "utf8"),
  );
  for (const slot of solution.slots) assert.ok(!html.includes(slot.answer));
  assert.ok(
    createResultSharePayload(puzzle, progress, base).text.length + 24 <= 280,
  );
});
test("link copying copies exactly the supplied URL", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied = "";
  try {
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
    const url = "https://example.test/puzzle/daily-2026-10-03/";
    assert.equal(await copyText(url), "copied");
    assert.equal(copied, url);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
