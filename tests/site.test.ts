import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emitSite, metadata, siteUrl } from "../scripts/lib/site.js";

test("static SEO output has readable content, canonical metadata, real images, structured data and release-aware sitemap", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "lingosaic-seo-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(join(output, "puzzles"));
  await writeFile(
    join(output, "index.html"),
    '<html lang="en"><head><title>Lingosaic</title><script src="./assets/app.js"></script></head><body><div id="root"></div></body></html>',
  );
  const catalog = JSON.parse(
    await readFile("public/puzzles/index.json", "utf8"),
  ).slice(0, 2);
  await writeFile(join(output, "puzzles/index.json"), JSON.stringify(catalog));
  for (const entry of catalog)
    await writeFile(
      join(output, `puzzles/${entry.date}.json`),
      await readFile(`public/puzzles/${entry.date}.json`),
    );
  const site = siteUrl("https://example.test/project");
  await emitSite(output, site, "2026-10-03");
  const html = await readFile(
    join(output, `puzzle/${catalog[0].id}/index.html`),
    "utf8",
  );
  assert.ok(
    html.includes(
      'href="https://example.test/project/puzzle/daily-2026-10-03/"',
    ),
  );
  assert.ok(
    html.includes(
      'property="og:image" content="https://example.test/project/share/default.png"',
    ),
  );
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(html.includes('src="../../assets/app.js"'));
  assert.ok(html.includes('href="../../favicon.svg"'));
  assert.ok(html.includes("<h1>Lingosaic #1"));
  assert.ok(html.includes("What is Lingosaic?"));
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.equal((html.match(/<title>/g) ?? []).length, 1);
  const data = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
  );
  assert.equal(data["@type"], "WebPage");
  assert.equal(
    data.breadcrumb.itemListElement[1].item,
    "https://example.test/project/puzzle/daily-2026-10-03/",
  );
  const privateSolution = JSON.parse(
    await readFile("private/solutions/daily-2026-10-03.solution.json", "utf8"),
  );
  for (const slot of privateSolution.slots)
    assert.ok(!html.includes(slot.answer));
  const future = await readFile(
    join(output, `puzzle/${catalog[1].id}/index.html`),
    "utf8",
  );
  assert.ok(future.includes('content="noindex,follow"'));
  const sitemap = await readFile(join(output, "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes(catalog[0].id));
  assert.ok(!sitemap.includes(catalog[1].id));
  const robots = await readFile(join(output, "robots.txt"), "utf8");
  assert.ok(robots.includes("User-agent: *\nAllow: /"));
  assert.ok(robots.includes("Disallow: /project/puzzles/"));
  assert.ok(robots.includes("https://example.test/project/sitemap.xml"));
  for (const page of ["how-to-play", "privacy", "accessibility", "terms"]) {
    const info = await readFile(join(output, page, "index.html"), "utf8");
    assert.ok(info.includes("<h1>"));
    assert.ok(!info.includes('type="module"'));
  }
  assert.ok(
    (await readFile(join(output, "llms.txt"), "utf8")).includes(
      "Three optional hints each reveal a whole word",
    ),
  );
  assert.ok((await readFile("public/share/default.png")).length > 1000);
});
test("metadata escapes markup and JSON-LD script termination without inventing ratings or answers", () => {
  const html = metadata(
    "A < B",
    '"unsafe" & description',
    "https://example.test/",
    siteUrl("https://example.test/"),
    { name: "</script><script>" },
  );
  assert.ok(html.includes("A &lt; B"));
  assert.ok(html.includes("&quot;unsafe&quot; &amp; description"));
  assert.ok(!html.includes("</script><script>"));
  assert.ok(!html.includes("aggregateRating"));
});

test("source HTML and development responses contain descriptions and metadata before JavaScript", async (t) => {
  const source = await readFile("index.html", "utf8");
  assert.ok(source.includes('name="description"'));
  assert.ok(source.includes('property="og:image"'));
  assert.ok(
    source.includes("Lingosaic is a daily themed silhouette word puzzle"),
  );
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const homeResponse = await fetch(base);
  assert.equal(homeResponse.status, 200);
  assert.ok(homeResponse.headers.get("x-robots-tag")?.includes("noindex"));
  const home = await homeResponse.text();
  assert.equal((home.match(/name="description"/g) ?? []).length, 1);
  assert.equal((home.match(/rel="canonical"/g) ?? []).length, 1);
  assert.ok(home.includes('content="noindex,follow"'));
  assert.ok(home.includes("application/ld+json"));
  const puzzle = await (await fetch(`${base}/puzzle/daily-2026-10-03/`)).text();
  assert.ok(puzzle.includes("Lingosaic #1 — Cards &amp; stationery"));
  assert.ok(
    puzzle.includes(
      `property="og:url" content="${new URL("puzzle/daily-2026-10-03/", siteUrl()).href}"`,
    ),
  );
  assert.equal((puzzle.match(/<title>/g) ?? []).length, 1);
  for (const [path, heading] of [
    ["how-to-play", "How to play Lingosaic"],
    ["privacy", "Privacy and browser storage"],
    ["accessibility", "Accessibility"],
    ["terms", "Using Lingosaic"],
  ]) {
    const response = await fetch(`${base}/${path}/`);
    assert.equal(response.status, 200);
    const page = await response.text();
    assert.ok(page.includes(`<h1>${heading}</h1>`));
    assert.ok(!page.includes("Operator and contact"));
    assert.ok(!page.includes("must be supplied before public launch"));
    assert.ok(!page.includes("/src/main.tsx"));
    assert.ok(page.includes('content="noindex,follow"'));
    assert.equal((await fetch(`${base}/${path}/index.html`)).status, 200);
    const redirect = await fetch(`${base}/${path}`, { redirect: "manual" });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), `/${path}/`);
  }
  assert.equal(
    (
      await fetch(
        `${base}/@fs${process.cwd()}/private/solutions/daily-2026-10-03.solution.json`,
      )
    ).status,
    403,
  );
});
