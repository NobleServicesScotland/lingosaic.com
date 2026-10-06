import { networkInterfaces } from "node:os";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SolutionView } from "../../src/components/SolutionView.js";
import {
  parseDailyPuzzle,
  type CatalogEntry,
  type DailyPuzzle,
} from "../../src/lib/daily.js";
import type { PrivateSolution } from "./artifacts.js";
import { isComplete } from "../../src/lib/puzzle.js";
export const INSPECTOR_HOST = "0.0.0.0";
export function inspectorHosts(): string[] {
  return [
    ...new Set([
      "127.0.0.1",
      "localhost",
      ...Object.values(networkInterfaces()).flatMap((addresses) =>
        (addresses ?? [])
          .filter((address) => address.family === "IPv4")
          .map((address) => address.address),
      ),
    ]),
  ];
}
export function inspectorUrls(port = INSPECTOR_PORT): string[] {
  return inspectorHosts()
    .filter((host) => host !== "localhost")
    .map((host) => `http://${host}:${port}/`);
}
export const INSPECTOR_PORT = 5174;
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export async function renderInspector(
  root: string,
  requestedDate?: string,
): Promise<string> {
  const read = async (path: string) =>
    JSON.parse(await readFile(resolve(root, path), "utf8"));
  let catalog: CatalogEntry[];
  try {
    catalog = await read("public/puzzles/index.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    catalog = [];
  }
  let puzzle: DailyPuzzle,
    solution: PrivateSolution,
    index = 0;
  if (catalog.length) {
    index = requestedDate
      ? catalog.findIndex((entry) => entry.date === requestedDate)
      : 0;
    if (index < 0) throw new Error("Unknown puzzle date");
    puzzle = parseDailyPuzzle(
      await read(`public/puzzles/${catalog[index].date}.json`),
    );
    solution = await read(`private/solutions/${puzzle.id}.solution.json`);
  } else {
    const demo = await read("public/puzzles/demo.json");
    solution = await read("private/solutions/demo.solution.json");
    puzzle = {
      ...demo,
      date: "2026-10-16",
      daily_number: 1,
      description: "Different garden words, woven into one silhouette.",
      silhouette: demo.shape.rows,
      cell_hashes: {},
    };
  }
  if (!(await isComplete(puzzle, solution.solved_grid)))
    throw new Error("Private solution does not match published validator");
  const css = await readFile(resolve(root, "src/style.css"), "utf8").catch(() =>
    readFile(new URL("../../src/style.css", import.meta.url), "utf8"),
  );
  const previous = catalog[index - 1],
    next = catalog[index + 1];
  const navigation = `<nav class="inspector-nav" aria-label="Browse solved puzzles">${previous ? `<a aria-label="Previous puzzle" href="/?date=${previous.date}">← Previous</a>` : '<span class="disabled">← Previous</span>'}<span>${index + 1} / ${catalog.length || 1}</span>${next ? `<a aria-label="Next puzzle" href="/?date=${next.date}">Next →</a>` : '<span class="disabled">Next →</span>'}</nav>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private Lingosaic inspector</title><style>${css}</style></head><body><main class="site-shell"><header class="site-header"><a class="brand" href="/">lingosaic<span>INSPECTOR</span></a><p>Development · solutions only</p></header>${navigation}${renderToStaticMarkup(createElement(SolutionView, { puzzle, letters: solution.solved_grid, mode: "inspector" }))}<footer class="site-footer">${escape(puzzle.date)} · approved, uniquely validated puzzle</footer></main></body></html>`;
}
export function createInspectorServer(root = process.cwd()) {
  return createServer(async (request, response) => {
    const address = request.socket.localPort;
    if (
      !inspectorHosts()
        .map((host) => `${host}:${address}`)
        .includes(request.headers.host ?? "")
    ) {
      response.writeHead(403);
      response.end("Local server host required");
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(405);
      response.end("Method not allowed");
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    try {
      const html = await renderInspector(
        root,
        url.searchParams.get("date") ?? undefined,
      );
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : html);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(
        `Inspector could not read or verify demo artifacts. Run npm run prepare:daily.\n${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  });
}
export async function startInspector(
  root = process.cwd(),
  port = INSPECTOR_PORT,
) {
  const server = createInspectorServer(root);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, INSPECTOR_HOST, resolve);
  });
  return server;
}
