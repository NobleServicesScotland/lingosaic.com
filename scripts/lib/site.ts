import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogEntry, DailyPuzzle } from "../../src/lib/daily.js";
import {
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_INTRODUCTION,
  PLAY_RULES,
} from "../../src/lib/site-content.js";
export function replacePageMetadata(html: string, head: string): string {
  return html.includes("<!-- lingosaic:metadata:start -->")
    ? html.replace(
        /<!-- lingosaic:metadata:start -->[\s\S]*?<!-- lingosaic:metadata:end -->/,
        head,
      )
    : html.replace(/<title>[\s\S]*?<\/title>/, head);
}
export function homeStructuredData(site: URL) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": new URL("#website", site).href,
        name: "Lingosaic",
        url: site.href,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        name: "Lingosaic",
        url: site.href,
        applicationCategory: "GameApplication",
        operatingSystem: "Web browser",
        isAccessibleForFree: true,
        description: SITE_DESCRIPTION,
      },
    ],
  };
}
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function siteUrl(
  value = process.env.LINGOSAIC_SITE_URL ?? "https://lingosaic.com/",
): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Site URL must be HTTP(S)");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url;
}
const rules = `<h2>What is Lingosaic?</h2><p>${SITE_INTRODUCTION}</p><h2>How do I play?</h2><p>${PLAY_RULES}</p><h2>What does a hint do?</h2><p>Each of your three hints reveals one complete word. Hints are optional and are counted in your result. Underlined letters are fixed seeds; dotted letters were revealed by hints.</p><h2>When does the timer start?</h2><p>The timer begins when you press Start and stops when the complete grid matches the solution. Time away from the puzzle counts. Progress and results can be saved on this browser.</p><h2>Can I share without spoilers?</h2><p>Share the puzzle as a challenge, or share your time and hint count after solving. Shared text never includes answer words or letters.</p>`;
export const infoPages: Record<
  string,
  { title: string; description: string; body: string }
> = {
  "how-to-play": {
    title: "How to play Lingosaic",
    description:
      "Learn the rules of Lingosaic: themed silhouette word puzzles, crossing letters, fixed seeds and three whole-word hints.",
    body:
      rules +
      `<h2>Start and enter letters</h2><p>Press Start to reveal the grid. Click or tap a cell, then type A–Z. With a keyboard, use Tab to reach a cell and arrow keys to move. Backspace or Delete clears editable letters. Letters underlined with a solid border are fixed helping letters; dotted borders indicate whole-word hints.</p><h2>Finishing your puzzle</h2><p>A full grid is complete only when every entry matches the unique solution. An incorrect full grid remains unsolved; individual mistakes are not highlighted. On completion, the timer stops and your solved grid stays visible. Copy your result and permanent puzzle link, or use WhatsApp or Twitter to prepare a spoiler-free post.</p><h2>Examples and saving</h2><p>Example shows yesterday’s solved puzzle where available. Progress and results stay on this browser when saving is enabled. Manage saving or delete Lingosaic records using the game footer.</p>`,
  },
  privacy: {
    title: "Privacy and browser storage",
    description:
      "How Lingosaic saves puzzle progress locally and handles sharing and website hosting.",
    body: `<h2>Local puzzle data</h2><p>Lingosaic stores your entered letters, revealed hint cells, hint count, start and finish timestamps and solved state in your browser's localStorage when you play. This restores your puzzle after a reload. These game records are not sent to a Lingosaic server or social network automatically. They remain until you delete them, your browser clears storage, or you use a different browser or device.</p><h2>Your controls</h2><p>Use “Delete saved puzzle data” in the game's footer to remove only Lingosaic records, or clear site data in your browser settings. Saving can be disabled in the game footer; you can still play for the current session. A blocked storage API does not prevent play.</p><h2>Cookies, advertising and tracking</h2><p>The application uses no cookies, analytics, advertising pixels, accounts or tracking SDKs. Browser storage serves puzzle progress, results and your storage preference. There are no optional marketing trackers to consent to.</p><h2>Sharing</h2><p>Social links contact their destination only when you choose to open them. Sharing sends puzzle URLs and, for results, the date, theme, elapsed time and hint count. Those services apply their own privacy policies. Clipboard copy stays on your device; native sharing is handled by your operating system.</p><h2>Hosting</h2><p>The production site is intended for GitHub Pages. A hosting provider receives technical request information, such as your IP address, to deliver pages and maintain security. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener noreferrer">GitHub's privacy statement</a> for its processing and retention. During development, requests go to the local development server.</p>`,
  },
  accessibility: {
    title: "Accessibility",
    description:
      "Keyboard controls, visible focus, readable puzzle grids and accessibility features in Lingosaic.",
    body: `<h2>Playing with a keyboard</h2><p>Tab to Start, then Tab to a grid cell. Type A–Z to enter a letter. Arrow keys move through the grid; Backspace and Delete clear editable cells. All hints, sharing controls and links work with a keyboard. Escape closes the example dialog and returns focus to its opener.</p><h2>Visual and assistive features</h2><p>The page has a skip link, labeled cells with row and column coordinates, visible keyboard focus, screen-reader status messages and native dialog focus handling. Seeds are underlined and hint letters have dotted borders, so their meaning does not depend on colour. Browser zoom is enabled. The timer is not announced on every tick.</p><h2>Known limitations</h2><p>Solving is a spatial word task. Screen readers can navigate labeled cells, but there is currently no alternative linear puzzle mode. Small screens may require horizontal scrolling of the grid to preserve touch target sizes. No independent accessibility certification is claimed.</p>`,
  },
  terms: {
    title: "Using Lingosaic",
    description:
      "Information about playing Lingosaic, saved progress and sharing puzzle results.",
    body: `<h2>Play and sharing</h2><p>Lingosaic provides word puzzles for personal play. You may share links and spoiler-free result text. There are no accounts, purchases, subscriptions or public leaderboards in this version.</p><h2>Progress and availability</h2><p>Saved results belong to the browser and device where you played. Clearing site data removes those results. Puzzle availability and the website may change; keep your own copy of results you want to retain.</p><h2>External services</h2><p>Following a social link opens another service, whose own terms and privacy information apply. Nothing is posted automatically.</p>`,
  },
};
export function metadata(
  title: string,
  description: string,
  canonical: string,
  site: URL,
  structured: unknown,
  indexable = true,
): string {
  const image = new URL("share/default.png", site).href;
  return `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${indexable ? "index,follow,max-image-preview:large" : "noindex,follow"}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Lingosaic"><meta property="og:locale" content="en_GB"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Lingosaic — daily themed silhouette word puzzles"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><meta name="twitter:image:alt" content="Lingosaic — daily themed silhouette word puzzles"><script type="application/ld+json">${JSON.stringify(structured).replaceAll("<", "\\u003c")}</script>`;
}
const icons = (prefix: string) =>
  `<meta name="theme-color" content="#193f3b"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml"><link rel="icon" href="${prefix}favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="${prefix}apple-touch-icon.png"><link rel="manifest" href="${prefix}site.webmanifest">`;
function navigation(prefix: string): string {
  return `<nav aria-label="Site information"><a href="${prefix}how-to-play/">How to play</a> · <a href="${prefix}privacy/">Privacy &amp; storage</a> · <a href="${prefix}accessibility/">Accessibility</a> · <a href="${prefix}terms/">Terms</a></nav>`;
}
export async function writeInfoPages(
  output: string,
  site = siteUrl(),
): Promise<void> {
  for (const [path, page] of Object.entries(infoPages)) {
    const canonical = new URL(`${path}/`, site).href;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${icons("../")}${metadata(page.title + " | Lingosaic", page.description, canonical, site, { "@context": "https://schema.org", "@type": "WebPage", name: page.title, description: page.description, url: canonical, inLanguage: "en" })}<link rel="stylesheet" href="../information.css"></head><body><a class="skip-link" href="#content">Skip to content</a><main id="content" class="site-shell" tabindex="-1"><header><a class="brand" href="../">lingosaic</a></header><article><h1>${escapeHtml(page.title)}</h1>${page.body}</article><footer><p><a href="../">Play Lingosaic →</a></p>${navigation("../")}</footer></main></body></html>`;
    await mkdir(join(output, path), { recursive: true });
    await writeFile(join(output, path, "index.html"), html);
  }
}
export async function emitSite(
  output = "dist",
  site = siteUrl(),
  today = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const catalog: CatalogEntry[] = JSON.parse(
    await readFile(join(output, "puzzles/index.json"), "utf8"),
  );
  const template = await readFile(join(output, "index.html"), "utf8");
  const title = SITE_TITLE;
  const description = SITE_DESCRIPTION;
  const wrap = (head: string, body: string, prefix: string) =>
    replacePageMetadata(
      template.replace(
        /<link rel="icon"[^>]*>|<meta name="theme-color"[^>]*>/g,
        "",
      ),
      head +
        icons(prefix) +
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">`,
    ).replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${body}</div>`);
  const graph = homeStructuredData(site);
  const published = catalog.filter((entry) => entry.date <= today);
  const links = published
    .map(
      (entry) =>
        `<li><a href="puzzle/${escapeHtml(entry.id)}/">${escapeHtml(entry.date)} — ${escapeHtml(entry.theme)}</a></li>`,
    )
    .join("");
  const home = `<main class="site-shell"><h1>${title}</h1><p>${description}</p>${rules}<p><a href="how-to-play/">Read the rules</a>. Interactive play requires JavaScript.</p>${links ? `<h2>Published puzzles</h2><ul>${links}</ul>` : `<p>The first daily puzzle is available on ${escapeHtml(catalog[0]?.date ?? "the first scheduled date")}.</p>`}${navigation("")}</main>`;
  await writeFile(
    join(output, "index.html"),
    wrap(metadata(title, description, site.href, site, graph), home, "./"),
  );
  for (const entry of catalog) {
    const p: DailyPuzzle = JSON.parse(
      await readFile(join(output, `puzzles/${entry.date}.json`), "utf8"),
    );
    const canonical = new URL(`puzzle/${entry.id}/`, site).href;
    const name = `Lingosaic #${p.daily_number} — ${p.theme.name} | ${entry.date}`;
    const desc = `A ${p.shape.name} silhouette puzzle about ${p.theme.name}. ${p.description} Solve crossing words with fixed seed letters and three optional whole-word hints.`;
    const released = entry.date <= today;
    const structured = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name,
      description: desc,
      url: canonical,
      inLanguage: "en",
      isPartOf: { "@id": new URL("#website", site).href },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Lingosaic",
            item: site.href,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `Puzzle #${p.daily_number}`,
            item: canonical,
          },
        ],
      },
    };
    const body = `<main class="site-shell"><p><a href="../../">Lingosaic</a></p><h1>${escapeHtml(name)}</h1><p><time datetime="${entry.date}">${entry.date}</time> · ${escapeHtml(p.shape.name)}</p><p>${escapeHtml(p.description)}</p><p>${released ? "Play this puzzle with JavaScript enabled." : `This puzzle becomes playable on ${entry.date}.`}</p>${rules}${navigation("../../")}</main>`;
    const folder = join(output, "puzzle", entry.id);
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, "index.html"),
      wrap(
        metadata(name, desc, canonical, site, structured, released),
        body,
        "../../",
      ).replaceAll("./assets/", "../../assets/"),
    );
  }
  await writeInfoPages(output, site);
  const urls = [
    site.href,
    ...Object.keys(infoPages).map((path) => new URL(`${path}/`, site).href),
    ...published.map((entry) => new URL(`puzzle/${entry.id}/`, site).href),
  ];
  await writeFile(
    join(output, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeHtml(url)}</loc></url>`).join("")}</urlset>`,
  );
  await writeFile(
    join(output, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: ${site.pathname}puzzles/\nSitemap: ${new URL("sitemap.xml", site).href}\n`,
  );
  await writeFile(
    join(output, "llms.txt"),
    `# Lingosaic\n\n> Daily themed silhouette crossword-like word puzzles, with no individual clues.\n\n## Rules\n\nFill every playable cell to complete crossing words across and down. Each word belongs to the puzzle theme. Crossings agree. Words never repeat. Published seed letters ensure one valid solution. Three optional hints each reveal a whole word.\n\n## Public information\n${Object.keys(
      infoPages,
    )
      .map(
        (path) =>
          `- [${infoPages[path].title}](${new URL(`${path}/`, site).href}): ${infoPages[path].description}`,
      )
      .join(
        "\n",
      )}\n\n## Play\n\n- [Lingosaic](${site.href}): The current daily puzzle. Permanent puzzle URLs use /puzzle/{puzzleId}/. Shared results contain time and hints, never answers.\n\nNo public answer key is provided. Puzzle solutions and developer inspection are excluded from the public website.\n`,
  );
  await writeFile(
    join(output, "404.html"),
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Lingosaic</title></head><body><main><h1>Page not found</h1><p><a href="${escapeHtml(site.href)}">Return to Lingosaic</a></p></main></body></html>`,
  );
  console.log(
    `Emitted ${catalog.length} static puzzle pages, ${published.length} indexable puzzles, informational pages, sitemap, robots and llms.txt.`,
  );
}
