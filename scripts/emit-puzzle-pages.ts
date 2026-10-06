import { emitSite } from "./lib/site.js";
emitSite().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
