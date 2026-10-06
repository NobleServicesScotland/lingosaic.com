import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { generate } from "../src/lib/puzzle.js";
import { artifactPaths, createArtifacts } from "./lib/artifacts.js";
async function main() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      ![
        "--shape",
        "--words",
        "--seed",
        "--id",
        "--out",
        "--debug-out",
      ].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error(
        "Usage: npm run generate -- --shape FILE --words FILE --seed SEED --id ID --out FILE [--debug-out private/answer.json]",
      );
    options[args[i].slice(2)] = args[i + 1];
  }
  for (const key of ["shape", "words", "seed", "id", "out"])
    if (!options[key]) throw new Error(`Missing --${key}`);
  if (options["debug-out"]) {
    const path = relative(resolve("private"), resolve(options["debug-out"]));
    if (!path || path.startsWith("..") || path.startsWith("/"))
      throw new Error("--debug-out must be inside private/");
  }
  const shape = JSON.parse(await readFile(options.shape, "utf8")),
    words = JSON.parse(await readFile(options.words, "utf8"));
  const paths = artifactPaths(options.id, options.out);
  const result = generate(shape, words, options.seed);
  const { puzzle, solution, report } = await createArtifacts(
    result,
    options.id,
    options.seed,
    paths,
  );
  for (const [path, data] of [
    [paths.public, puzzle],
    [paths.solution, solution],
    [paths.report, report],
  ] as const) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  }
  if (options["debug-out"]) {
    await mkdir(dirname(options["debug-out"]), { recursive: true });
    await writeFile(
      options["debug-out"],
      JSON.stringify(result.target, null, 2) + "\n",
    );
  }
  console.log(
    `Shape: ${result.layout.shape.name}\nSlots: ${result.layout.slots.length}\nApproved words: ${result.dictionary.entries.length}\nSeed: ${options.seed}\nRevealed letters: ${Object.keys(result.seeds).length}/${result.layout.cells.length}\nUniqueness: exactly 1 solution\nOutput: ${options.out}\nPrivate solution: ${paths.solution}\nQA report: ${paths.report}`,
  );
}
main().catch((error) => {
  console.error(`Generation failed: ${error.message}`);
  process.exitCode = 1;
});
