import { spawn } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "vite";
import { startInspector, inspectorUrls } from "./lib/inspector.js";
async function main() {
  const generation = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "prepare:daily"],
    { stdio: "inherit" },
  );
  const [code] = await once(generation, "exit");
  if (code !== 0) throw new Error("Demo generation failed");
  const vite = await createServer({
    server: { host: "0.0.0.0", port: 5173, strictPort: true },
  });
  let inspector: Awaited<ReturnType<typeof startInspector>> | undefined;
  const stop = async () => {
    if (inspector) {
      inspector.closeAllConnections();
      await new Promise<void>((resolve) => inspector!.close(() => resolve()));
    }
    await vite.close();
    if (process.env.LINGOSAIC_READY_FILE)
      await rm(process.env.LINGOSAIC_READY_FILE, { force: true });
  };
  try {
    await vite.listen();
    inspector = await startInspector();
  } catch (error) {
    await stop();
    throw error;
  }
  if (process.env.LINGOSAIC_READY_FILE)
    await writeFile(process.env.LINGOSAIC_READY_FILE, "ready\n");
  console.log(
    `\nLingosaic:\nhttp://127.0.0.1:5173/\n\nDeveloper inspector:\n${inspectorUrls().join("\n")}\n\nCtrl-C stops both servers.`,
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void stop().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
}
main().catch((error) => {
  console.error(`Demo failed: ${error.message}`);
  process.exitCode = 1;
});
