import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseDailyPuzzle } from "../../src/lib/daily.js";
import { parsePuzzle } from "../../src/lib/puzzle.js";
async function files(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(root, entry.name))
          : Promise.resolve([join(root, entry.name)]),
      ),
    );
    return nested.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export async function checkPublicBuild(root = process.cwd()): Promise<number> {
  const dist = join(root, "dist"),
    outputFiles = await files(dist),
    privateFiles = await files(join(root, "private"));
  if (!outputFiles.length)
    throw new Error("Production output is missing; run the Vite build first");
  const privateContent = await Promise.all(
    privateFiles.map(async (path) => ({ path, data: await readFile(path) })),
  );
  const answers = new Set<string>(),
    solvedRows = new Set<string>();
  for (const file of privateContent) {
    if (!file.path.endsWith(".json")) continue;
    const artifact = JSON.parse(file.data.toString("utf8"));
    for (const slot of artifact.slots ?? [])
      if (typeof slot.answer === "string") answers.add(slot.answer);
    for (const word of artifact.words ?? [])
      if (typeof word === "string") answers.add(word); // Legacy --debug-out.
    for (const row of artifact.solved_rows ?? [])
      if (typeof row === "string" && (row.match(/[A-Z]/g)?.length ?? 0) >= 3)
        solvedRows.add(row);
  }
  const catalogPath = outputFiles.find(
    (path) =>
      relative(dist, path).replaceAll("\\", "/") === "puzzles/index.json",
  );
  const publishedThemes: string[] = catalogPath
    ? JSON.parse(await readFile(catalogPath, "utf8")).map(
        (entry: { theme: string }) => entry.theme,
      )
    : [];
  // Descriptions already published in the spoiler-safe player payload may contain
  // theme acronyms that coincide with another puzzle's dictionary entry.
  const publishedDescriptions: string[] = [];
  for (const path of outputFiles) {
    const name = relative(dist, path).replaceAll("\\", "/");
    if (/^puzzles\/[^/]+\.json$/.test(name) && name !== "puzzles/index.json") {
      const p = JSON.parse(await readFile(path, "utf8"));
      if (typeof p.description === "string")
        publishedDescriptions.push(p.description);
    }
  }
  const htmlEscape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  for (const path of outputFiles) {
    const name = relative(dist, path).replaceAll("\\", "/");
    if (
      name
        .split("/")
        .some((part) =>
          ["private", "inspector", "solutions", "reports"].includes(part),
        )
    )
      throw new Error(`Private file path in production: ${name}`);
    const buffer = await readFile(path),
      text = buffer.toString("utf8");
    if (
      /127\.0\.0\.1:5174|localhost:5174|Developer inspector|Private Lingosaic inspector|Solve puzzle|The preview puzzle could not be solved/.test(
        text,
      )
    )
      throw new Error(`Inspector content in production: ${name}`);
    if (/"(?:solved_grid|solved_rows|answer|uniqueness_count)"\s*:/.test(text))
      throw new Error(`Private QA data in production: ${name}`);
    for (const file of privateContent)
      if (
        buffer.equals(file.data) ||
        (file.data.length >= 64 && buffer.includes(file.data))
      )
        throw new Error(
          `Private file copied into production: ${relative(root, file.path)}`,
        );
    for (const row of solvedRows)
      if (text.includes(row))
        throw new Error(`Solved grid in production: ${name}`);
    // SCRIPT is also an HTML tag name in React's DOM housekeeping. Ignore only
    // those paired DOM-tag branches, not standalone strings or puzzle data.
    let answerText = text
      .replace(
        /(\b[A-Za-z_$][\w$]*)==="SCRIPT"\|\|\1==="STYLE"/g,
        '$1===""||$1==="STYLE"',
      )
      .replace(
        /case"SCRIPT":case"STYLE":continue;case"LINK"/g,
        'case"":case"STYLE":continue;case"LINK"',
      );
    // Published theme names are player-facing metadata, not answer records.
    // E.g. STEM is both a theme acronym and a word in another day's dictionary.
    if (name.endsWith(".json") || name.endsWith(".html")) {
      for (const theme of [...publishedThemes, ...publishedDescriptions])
        answerText = answerText
          .replaceAll(JSON.stringify(theme), '""')
          .replaceAll(htmlEscape(theme), "")
          .replaceAll(theme, "");
    }
    if (
      name.startsWith("puzzles/") &&
      name.endsWith(".json") &&
      name !== "puzzles/index.json"
    ) {
      const metadata = JSON.parse(text);
      for (const value of [
        metadata.description,
        metadata.theme?.name,
        metadata.shape?.name,
      ]) {
        if (typeof value === "string")
          answerText = answerText.replaceAll(JSON.stringify(value), '""');
      }
    }
    // Whole uppercase tokens avoid false positives from substrings in bundled identifiers.
    for (const word of answers)
      if (new RegExp(`\\b${word}\\b`).test(answerText))
        throw new Error(`Plaintext answer in production: ${name}`);
    if (name.startsWith("puzzles/") && name.endsWith(".json")) {
      const puzzle = JSON.parse(text);
      if (name === "puzzles/index.json") {
        if (
          !Array.isArray(puzzle) ||
          puzzle.some(
            (entry) =>
              !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
              typeof entry.id !== "string" ||
              typeof entry.theme !== "string" ||
              Object.keys(entry).some(
                (key) => !["id", "date", "theme"].includes(key),
              ),
          )
        )
          throw new Error("Invalid public calendar");
        continue;
      }
      if (puzzle.date) parseDailyPuzzle(puzzle);
      else parsePuzzle(puzzle);
      const allowed = [
        "schema_version",
        "id",
        "generator_version",
        "seed",
        "theme",
        "shape",
        "seeds",
        "validation",
        "date",
        "daily_number",
        "description",
        "silhouette",
        "cell_hashes",
      ];
      if (Object.keys(puzzle).some((key) => !allowed.includes(key)))
        throw new Error(`Unexpected public puzzle field: ${name}`);
    }
  }
  return outputFiles.length;
}
