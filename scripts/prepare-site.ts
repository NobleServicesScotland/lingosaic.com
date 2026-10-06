import { writeInfoPages } from "./lib/site.js";
writeInfoPages("public").catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
