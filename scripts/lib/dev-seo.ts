import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import type { DailyPuzzle } from "../../src/lib/daily.js";
import { SITE_TITLE, SITE_DESCRIPTION } from "../../src/lib/site-content.js";
import {
  homeStructuredData,
  metadata,
  replacePageMetadata,
  siteUrl,
} from "./site.js";

export function developmentSeo(): Plugin {
  return {
    name: "lingosaic-development-metadata",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      async handler(html, context) {
        const site = siteUrl();
        const pathname = new URL(
          context.originalUrl ?? context.path,
          "http://localhost",
        ).pathname;
        const id = pathname.match(
          /^\/puzzle\/(daily-\d{4}-\d{2}-\d{2})\/(?:index\.html)?$/,
        )?.[1];
        let title = SITE_TITLE,
          description = SITE_DESCRIPTION,
          canonical = site.href;
        let structured: unknown = homeStructuredData(site);
        if (id) {
          try {
            const p: DailyPuzzle = JSON.parse(
              await readFile(
                resolve("public/puzzles", `${id.replace("daily-", "")}.json`),
                "utf8",
              ),
            );
            title = `Lingosaic #${p.daily_number} — ${p.theme.name} | ${p.date}`;
            description = `A ${p.shape.name} silhouette puzzle about ${p.theme.name}. ${p.description}`;
            canonical = new URL(`puzzle/${p.id}/`, site).href;
            structured = {
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: title,
              description,
              url: canonical,
              inLanguage: "en",
            };
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
        return replacePageMetadata(
          html,
          metadata(title, description, canonical, site, structured, false),
        ).replace('href="./favicon.svg"', 'href="/favicon.svg"');
      },
    },
  };
}
