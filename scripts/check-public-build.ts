import { checkPublicBuild } from "./lib/public-build.js";
checkPublicBuild()
  .then((count) =>
    console.log(
      `Public/private boundary passed: ${count} production files; no private artifacts, plaintext solutions, or inspector UI.`,
    ),
  )
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
