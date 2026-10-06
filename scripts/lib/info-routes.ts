import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

// Vite's public-file middleware does not resolve directory index files.
// Route only the four known information pages; never serve arbitrary paths.
export function informationRoutes(): Plugin {
  return {
    name: "lingosaic-information-pages",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD")
          return next();
        const url = new URL(request.url ?? "/", "http://localhost");
        const match = url.pathname.match(
          /^\/(how-to-play|privacy|accessibility|terms)(?:\/(?:index\.html)?)?$/,
        );
        if (!match) return next();
        if (url.pathname === `/${match[1]}`) {
          response.writeHead(301, {
            Location: `/${match[1]}/${url.search}`,
            "X-Robots-Tag": "noindex, nofollow",
          });
          response.end();
          return;
        }
        try {
          const html = await readFile(
            resolve(server.config.publicDir, match[1], "index.html"),
            "utf8",
          );
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Robots-Tag": "noindex, nofollow",
          });
          response.end(
            request.method === "HEAD"
              ? undefined
              : html.replace(
                  /<meta name="robots" content="[^"]*">/,
                  '<meta name="robots" content="noindex,follow">',
                ),
          );
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
