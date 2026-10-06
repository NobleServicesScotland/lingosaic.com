import {
  startInspector,
  inspectorUrls,
  INSPECTOR_PORT,
} from "./lib/inspector.js";
startInspector()
  .then((server) => {
    console.log(
      `Developer inspector:\n${inspectorUrls(INSPECTOR_PORT).join("\n")}`,
    );
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.once(signal, () => {
        server.close();
        server.closeAllConnections();
      });
  })
  .catch((error) => {
    console.error(`Inspector failed: ${error.message}`);
    process.exitCode = 1;
  });
