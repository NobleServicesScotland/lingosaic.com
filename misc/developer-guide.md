# Lingosaic developer reference

Detailed architecture, generator and QA documentation. Run commands from the repository root. For the public project overview, see [README](../README.md). Moving this document into `misc/` does not make it private; it remains part of the public repository.

Lingosaic is a themed silhouette crossword-like puzzle. The player sees a silhouette-shaped grid, one overall theme, some prefilled seed letters, and otherwise empty playable cells. There are **no individual crossword clues**.

Every maximal horizontal or vertical playable run of at least **three cells** is a word slot. Each slot must contain one approved alphabetic English single word from the supplied theme dictionary. Crossing words share the same letter, and no word may be reused within a puzzle. The player deduces entries from the common theme, word lengths, crossings, and seed letters. A published puzzle must have exactly **one** valid solution under its approved dictionary and revealed seeds.

## Daily website and development environment

The supplied pack under `puzzles/lingosaic-daily-dense-2026-10-03_to_2027-01-31/` is now the website's daily calendar: **121 days, 3 October 2026–31 January 2027**. The importer validates the declared slots, dictionary membership, no repeated entries, source hash, and exactly one solution using the existing solver. It does not regenerate or change supplied answers or dictionaries.

```sh
npm install
./lingosaic.sh start
./lingosaic.sh state
./lingosaic.sh stop
```

`start` imports/verifies the pack and runs both servers detached. Repeated starts are safe; `stop` terminates only the recorded development process group. Logs and PID/readiness files live in gitignored `.lingosaic-run/`. `state` prints the server URLs. Start/stop/state require Linux `flock`, `setsid`, and `curl`.

- **Lingosaic server:** http://127.0.0.1:5173/ (or your development server’s IP on port 5173).
- **Inspector server:** http://127.0.0.1:5174/ (or your development server’s IP on port 5174).

Both development servers bind to all IPv4 interfaces, as requested. `npm run demo` runs the same daily environment in the foreground; Ctrl-C stops it. `npm run dev` and `npm run inspector` remain available separately, and prepare the daily data first. Inspector source/answers remain excluded from the production app.

### Player experience

The welcome screen shows the theme and description. **Start puzzle** reveals the grid and begins timing. The full silhouette is visible, including its internal stop blocks; editable cells remain square. Click a cell, type A–Z, use arrows to move and select typing direction, or use Backspace/Delete. There are no Across/Down or Restart buttons. Seed letters are underlined and fixed.

**Hint** reveals one complete word and locks its editable cells with dotted underlines. There are three hints per puzzle. The button shows the number remaining and its percentage (100%, 67%, 33%, 0%) and changes green → amber → orange → disabled. It can correct a wrong entered letter without highlighting other wrong cells. Browser storage saves entries, hint usage, and start/finish timestamps; a reload resumes the same puzzle and a valid saved completion remains solved. The timer counts wall-clock time after Start, including time away from the page, and stops at completion.

After the whole-grid hash matches, congratulations and the solved silhouette stay visible. Sharing appears only here: “Copy my result and puzzle link” copies the complete spoiler-free result plus permanent URL. WhatsApp and Twitter prefill that complete post. Facebook, LinkedIn, pre-solve sharing and the separate link-copy button have been removed. “More sharing options…” uses the OS share sheet where supported. Clipboard failure exposes selectable manual text rather than an alert.

**Example** opens the previous calendar day's solved puzzle with its theme/description in a keyboard-accessible modal; it is absent for 3 October because the pack has no preceding puzzle. Escape or Close dismisses it. The production website selects the UTC calendar date, or a released puzzle identified by its permanent URL. Before/after the supplied date range it shows an availability message. Development defaults to the first supplied puzzle when today is outside the range, and provides a date selector for all 121 days.

The inspector is now a simple Previous/Next gallery of the same solution cards used by the completed player and Example modal. It reads private solutions and verifies their completion hashes; it does not invent solving times or player statistics.

### Import, static build and sharing

```sh
npm run prepare:daily
npm test
npm run typecheck
npm run build
```

Public daily files live in `public/puzzles/YYYY-MM-DD.json` and the calendar in `public/puzzles/index.json`. Private fills/reports live in `private/solutions/daily-YYYY-MM-DD.solution.json` and `private/reports/daily-YYYY-MM-DD.report.json`. The original source pack is not served by the public Vite app or copied into `dist/`. The original demo and generic generator commands below remain available for generator development.

The dense pack uses source schema version 2: `#` outside the silhouette, `*` internal stop blocks, `.` editable cells and A–Z fixed seeds. The importer adapts this to the existing app without changing supplied solutions. The solver mask remains the original version-1 `Shape`: playable dots and blocked hashes. A separate public `silhouette` mask retains all inside cells, including stop blocks. Daily metadata adds date, daily number, description and `cell_hashes`. The existing whole-grid canonical SHA-256 validator is retained. Per-cell SHA-256 checks allow hints and yesterday's example without publishing plaintext solution files. A static client can recover those letters by trying A–Z; the three-hint limit is a player UI rule, **not strong anti-cheat security**. No production backend is required.

Every share links to `/puzzle/daily-YYYY-MM-DD/`. The build emits an `index.html` at each of these 121 paths, booting the same React app with relative assets and crawler-visible title, canonical, Open Graph and Twitter image metadata, descriptions, structured data and readable introductory content. Thus direct navigation/reload works on GitHub Pages without an SPA redirect hack. The client derives the base path/origin from its current URL for both data loading and sharing; project-site subpaths are supported. For a different canonical deployment URL, set `LINGOSAIC_SITE_URL=https://USER.github.io/REPO/` when building. The local generic social preview is `/share/default.png`; deployment is configured in `.github/workflows/pages.yml`.

Share formatting and native/clipboard/social behavior live in `src/lib/sharing.ts`. Sharing controls and the result preview live in `src/components/ShareControls.tsx`. Grid rendering lives in `src/components/PuzzleGrid.tsx` and `SolutionView.tsx`. Import/validation lives in `scripts/import-daily.ts`; dates/hints and persistence are in `src/lib/daily.ts` and `daily-progress.ts`.

The mandatory production boundary scan still rejects copied private artifacts, solved grids/answer fields, standalone answer tokens, and inspector URL/UI. It distinguishes explicitly published theme/description metadata (e.g. STEM) and React's paired HTML SCRIPT/STYLE handling from private answer records. Regression tests ensure actual standalone answer leaks remain rejected.

## Tiny explanatory example

Theme: **Astronomy**. Shape (`.` playable, `#` blocked):

```text
###.###
###.###
.......
###.###
###.###
```

A possible solution, shown here only to explain the rules:

```text
###V###
###E###
PLANETS
###U###
###S###
```

This has a horizontal slot of length 7, `PLANETS`, and a vertical slot of length 5, `VENUS`, crossing on **N**. The player does not receive PLANETS or VENUS as clues. They receive only the shared Astronomy theme, the mask, and whichever seed letters are revealed.

If two approved five-letter entries satisfy the same known crossing pattern, the solver may find multiple valid completions. That ambiguity is unacceptable. The generator reveals letters from its selected target fill until the solver proves `solution count = 1`. This example is documentation only; the actual garden-gate demo continues to use the real generator and its existing input files.

## Dictionary creation is separate from puzzle generation

The dictionary is an **already approved** themed `.word-list.json`, using structured words with a canonical `grid_entry`. It is the editorial authority for spelling, single-word status, and theme membership. The puzzle generator never calls an LLM or invents a word while filling a slot.

The future production dictionary pipeline is:

```text
theme definition
→ candidate generation
→ normalization
→ semantic/theme validation
→ spelling/lexical validation
→ prohibited-term filtering
→ duplicate/stemming checks where relevant
→ approval
→ final .word-list.json
→ puzzle generator
```

Those editorial stages precede filling; they are not an online service implemented here. The checked-in demo dictionary is approved fixture data, deterministic and offline. The existing input parser trims outer whitespace, uppercases ASCII entries, and rejects invalid entries and exact normalized duplicates. It does not stem, truncate, invent, or semantically approve entries. Any stemming-family policy belongs in dictionary approval.

## How the existing generator produces a puzzle

```text
SHAPE + APPROVED DICTIONARY + GENERATOR SEED
                    ↓
             SLOT EXTRACTION
                    ↓
          CANDIDATES BY LENGTH
                    ↓
       CROSSING-CONSTRAINT SOLVER
                    ↓
                TARGET FILL
                    ↓
            UNIQUENESS CHECK
                    ↓
       SEED LETTERS IF REQUIRED
                    ↓
              PUBLIC PUZZLE
```

The CLI parses inputs, extracts every maximal slot and its intersections, indexes exact-length candidates, and searches using minimum remaining values (MRV). Every placement agrees with existing crossing letters and fixed seeds; used words are excluded from other slots. Empty candidate domains backtrack. A small seeded PRNG shuffles sorted candidates deterministically. Slot ties follow stable extraction order. Identical inputs, seed, and generator version produce identical JSON; there are no generation timestamps.

After choosing a target fill, an independent solver run counts solutions, stopping at two. If ambiguous, compare a competing fill with the target and reveal the first row-major cell that differs. Repeat until exactly one solution remains, then remove added seeds that have become redundant; intentional input seeds are retained. Every added letter comes from the target. A 500,000-node budget applies to each solver call, and additions are bounded by playable-cell count. Budget exhaustion or impossibility exits nonzero with a diagnostic; neither is treated as uniqueness. Artifact assembly performs another final count and verifies the sole fill is the chosen target.

## Generate the real demo

Requires Node.js 22+ and npm.

```sh
npm install
npm run generate:demo
```

The existing shortcut executes:

```sh
npm run generate -- --shape data/shapes/demo.grid.json --words data/wordlists/demo.word-list.json --seed 1 --id demo --out public/puzzles/demo.json
```

The real fixture is **Garden gate**, with the theme **In the garden**:

- Shape: `data/shapes/demo.grid.json`.
- Approved dictionary: `data/wordlists/demo.word-list.json`.
- Public puzzle: `public/puzzles/demo.json`.
- Private solution: `private/solutions/demo.solution.json`.
- Private generation report: `private/reports/demo.report.json`.

The script fixes generator seed `1`. Read the live CLI report and private JSON artifacts for slot count, dictionary size, seed, revealed-letter count, final uniqueness result and seed coordinates. The current inspector is a daily solution gallery; it does not display the original generator demo or detailed Overview/Seeds sections. These are computed from the files rather than copied into documentation where counts could become stale. The current report is also available with:

```sh
cat private/reports/demo.report.json
```

Every generation writes all three artifacts. IDs use letters, digits, underscores or hyphens and start with a letter or digit, so output names cannot escape `private/`. The original CLI arguments and optional `--debug-out private/demo.answer.json` still work; the latter writes the legacy plaintext target for QA only.

## Original generator demo

`npm run generate:demo` still generates the original Garden gate fixture and private QA artifacts described above. The player website now uses the supplied daily calendar rather than `demo.json`. The generic generator, solver, input formats and original generator tests are preserved.

## Private QA and the public boundary

`private/` contains generated QA artifacts outside the public web root and is gitignored. The original input packs under `puzzles/` include plaintext solutions and are intentionally committed to this public repository; “private” describes the generated artifact/build boundary, not secrecy of puzzle answers. Solutions contain puzzle/shape/theme metadata, generator seed/version, the solved grid and rows, every slot's direction/cell coordinates/length/answer, crossings, input and published seed letters, final uniqueness count, and a snapshot of the approved dictionary used. Stored coordinates are zero-based; the inspector displays one-based row/column labels. Reports contain search result, counts, completion hash and output paths, without nondeterministic timings.

The Node HTTP inspector is now the daily solution gallery described above. Slot/crossing/dictionary QA data remains available in private solution/report JSON for generator development.

The inspector serves only its root page, refuses arbitrary file URLs and Host headers that do not match localhost or a current server interface address, and has no CORS/API or public build entry. Normal Vite development requests cannot read `private/`, tooling, tests, or source dictionary files. The production application imports none of the private tooling.

```sh
npm test
npm run typecheck
npm run build
npm run check:public-build
```

`npm run build` runs TypeScript, Vite, and the automated public/private boundary check. That check scans `dist/` for copied private files, private QA fields, known plaintext answers/solved rows, private paths, and inspector URL/UI. Focused tests exercise both clean and deliberately leaking outputs, actual CLI artifact creation, dictionary/solution/hash agreement, determinism, and the inspector's network binding and Host checks. No lint tool is configured.

## Repository

- `src/lib/puzzle.ts`: schemas, input parsing, slot extraction, crossings, deterministic solver, uniqueness generation, canonical hashing and client completion validation.
- `src/lib/player.ts`: pure navigation/timing and validated persistence helpers.
- `src/main.tsx`, `src/style.css`: daily React player and responsive styles.
- `src/components/`: shared silhouette and solution rendering.
- `src/lib/daily.ts`, `daily-progress.ts`, `sharing.ts`: daily metadata, hints, persistence, and spoiler-free results.
- `scripts/import-daily.ts`, `emit-puzzle-pages.ts`: supplied pack validation/import and static permalink emission.
- `lingosaic.sh`: detached development environment control.
- `scripts/generate-puzzle.ts`: existing Node/TypeScript CLI, extended to write private QA artifacts.
- `scripts/lib/artifacts.ts`: private artifact assembly using the existing solver.
- `scripts/inspector.ts`, `scripts/lib/inspector.ts`: separate Node developer inspector.
- `scripts/demo.ts`: daily-pack preparation and both server lifecycles.
- `scripts/check-public-build.ts`, `scripts/lib/public-build.ts`: production leak check.
- `data/shapes/`, `data/wordlists/`: approved source inputs.
- `public/puzzles/`: generated public puzzle payloads, copied unchanged by Vite.
- `tests/puzzle.test.ts`, `tests/qa.test.ts`: existing logic tests and incremental QA/boundary tests.
- `private/solutions/`, `private/reports/`: generated private QA data (gitignored).
- `AGENTS.md`: non-negotiable domain rules for future work.

## Generic generator version 1 inputs

Shape example:

```json
{
  "schema_version": 1,
  "id": "gate",
  "name": "Garden gate",
  "rows": ["...#...", ".#.#.#.", ".#.#.#."],
  "seeds": { "0": "F" }
}
```

`.` is playable and `#` is a separator or exterior. Rows must have equal width, 1–15 columns and 1–20 rows. No automatic silhouette design is performed. Runs shorter than three do not create slots. Every playable cell must belong to at least one valid slot; orphan cells are rejected because no dictionary constraint could determine their letters. Optional seeds map **zero-based row-major cell indices** (`row * width + column`, including blocked positions) to uppercase letters. Seeds must refer to playable cells. Disconnected silhouettes are allowed. Future existing-grid importers should convert their representation to this schema before invoking `parseShape`/`generate`.

Word-list example:

```json
{
  "schema_version": 1,
  "theme": { "id": "garden", "name": "In the garden" },
  "words": [{ "display": "Earth", "grid_entry": "EARTH" }]
}
```

The canonical entry is `grid_entry`, normalized only by trimming whitespace and uppercasing ASCII English letters. Reject punctuation, spaces inside entries, accented characters, empty entries, and duplicate normalized words. `display` is optional and never drives filling. The supplied list is the editorial authority for real English words and thematic appropriateness; the generator does not infer or create either. Candidates of unavailable lengths are never invented. The sample above describes the schema, not a sufficient dictionary for the sample shape.

## Generic generated puzzle schema

A version-1 public puzzle includes `schema_version`, `id`, `generator_version`, `seed`, `theme`, the input `shape`, final `seeds`, and `validation` (`algorithm: "SHA-256"`, `canonical_version: 1`, `hash`). There are no answer words or solved grid in the public payload. The canonical string is `lingosaic-grid-v1\n` followed by all mask rows, with `#` for blocked cells and uppercase entered letters for playable cells, joined by newlines, without a trailing newline. Completion requires every playable cell filled, every seed unchanged, and the canonical grid's SHA-256 hash matching.

Hashing avoids trivially publishing the answer in normal puzzle JSON. It is not strong anti-cheat security: the approved dictionaries and generation tooling are available, and static clients cannot hide secrets.

## Adding shapes and dictionaries

Create another version-1 shape and an editorially approved structured dictionary, then pass their paths and a seed to the CLI. Missing lengths or incompatible crossings must be fixed in the inputs, not by weakening validation. The generic generator writes standalone puzzle artifacts, but the current player loads only entries from the daily catalog. Writing `public/puzzles/demo.json` does not switch the player to that fixture. To add playable daily puzzles, adapt the supplied daily-pack format, extend its manifest, and update the active pack path in `scripts/import-daily.ts`; run `npm run prepare:daily` to validate and publish it. Permanent daily puzzle routing is already implemented.

Archive, accounts, production backend services, and automatic silhouette/word generation remain outside the current scope.

## Sharing, discovery, privacy and accessibility

Sharing controls appear only after verified completion. The branded preview explains Lingosaic, states the puzzle/theme/date, real elapsed time and hint count, and invites others to try it. “Copy my result and puzzle link” includes the permanent URL; WhatsApp and Twitter prefill the post. Native sharing sends `{title,text,url}` where available and treats cancellation normally. Sharing formatting lives in `src/lib/sharing.ts`, with no social SDKs or background requests.

Each Hint reveals one complete extracted slot. Up to three words can be revealed; crossing cells stay correct and locked. The percentage shows the remaining hint budget, not puzzle completion. `hintsUsed` is independent of the number of revealed cells. Older saves retain their existing single-letter hints and usage count.

`scripts/lib/site.ts` emits crawler-readable introductions and rules, titles, descriptions, canonical links, Open Graph and Twitter image metadata, WebSite/WebApplication/WebPage and breadcrumb JSON-LD, four information pages, `sitemap.xml`, `robots.txt`, `llms.txt` and a true GitHub Pages 404 document. Static puzzle pages boot the same application. There are no fake ratings, invisible keyword lists or answer keys. `llms.txt` is a supplemental readable guide, not a guaranteed ranking mechanism. AI search uses the same clear, crawlable public content as conventional search.

The Pages workflow sets `LINGOSAIC_SITE_URL=https://www.lingosaic.com/`. Standalone builds currently default to `https://lingosaic.com/`; set the environment variable explicitly for the intended canonical domain or full GitHub project URL including its base path. Only released puzzles appear in the sitemap; future pages use `noindex,follow`. **Rebuild and publish on each release date** to update static indexing metadata. The game itself chooses today's UTC puzzle at runtime. Submit the sitemap in Google Search Console/Bing Webmaster Tools after domain ownership and deployment; ranking and indexing cannot be guaranteed. GitHub Pages cannot configure custom HTTP security/cache headers: this version uses a document CSP for the app; hosting-level policy changes require suitable hosting. Keep HTTPS enforcement enabled in Pages. Root-level robots.txt is required for crawler control on a custom domain; a project-subdirectory robots file does not control the entire shared github.io origin.

Favicons, Apple touch icons, manifest icons and the generic 1200×630 social preview are local assets under `public/`; SVG sources are retained. No external fonts are fetched. Native share may require HTTPS in production; development clipboard fallback also handles the VPS HTTP URL.

“How to play”, “Privacy & storage”, “Accessibility” and “Terms” are readable static pages, available in development and production. The footer offers a save-progress toggle and confirmation before deleting only Lingosaic localStorage keys. No cookies, accounts, advertising or analytics exist. Storage retains puzzle entries, hints, timing and results locally until cleared; turning saving off permits session-only play. Hosting still receives ordinary page-request information, as explained in the privacy page.

Deployment requires no email, operator details, secrets or repository variables. Information pages explain actual browser storage, hosting and accessibility without an operator-contact placeholder.

Accessibility includes a skip link, real page headings, coordinate labels, fixed/hint markers independent of colour, visible focus, keyboard play, native modal focus handling, focus on successful completion, readable contrast, 44px controls, reduced-motion and forced-colour support. Phone grids can scroll horizontally to preserve 24px cells. The spatial puzzle does not yet have an alternative linear mode; the accessibility page states this limitation.

Implementation references: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Google AI search guidance](https://developers.google.com/search/docs/appearance/ai-features), [W3C accessibility principles](https://www.w3.org/WAI/fundamentals/accessibility-principles/), [ICO storage guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/), and [GitHub privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

The active pack is configured in `scripts/import-daily.ts`. Its manifest defines the date span and puzzle count; the importer verifies all dates before writing any replacement files. The dense pack contains 100 approved words per theme and 12–18 connected slots per puzzle. Existing browser results for changed puzzles are isolated by the new completion hash, so an older solve cannot complete a replacement grid. Original source packs remain outside the public web root and are denied by Vite.

Every daily word slot contains at least one fixed helping letter, which can be anywhere in the word, preferably at a crossing. `scripts/lib/helping-seeds.ts` preserves all supplied seeds, covers two unseeded words at a shared crossing where possible, then prefers crossings and resolves ties in row-major order. Already seeded slots need no additional letter. The import still independently proves uniqueness with the final published seeds; answers, completion hashes and original source files remain unchanged. Added helping-letter counts are recorded only in private QA reports.

### Where to see the description and meta tags

The game now keeps a visible introduction beneath its header and an expanded “What is Lingosaic?” section below the puzzle, even after JavaScript starts. Shared factual copy lives in `src/lib/site-content.ts`. The source `index.html` also has real baseline description, canonical, Open Graph/Twitter and WebSite metadata, plus a readable JavaScript-free introduction.

Development uses the Vite `developmentSeo` plugin (`scripts/lib/dev-seo.ts`) to generate raw page-specific metadata using the same serializer as production. Development responses intentionally include `noindex` and an `X-Robots-Tag` header. Production still emits each puzzle's static HTML, metadata and introductory content at build time; metadata blocks are replaced rather than duplicated, and configured project base URLs are retained. Inspect with View Source or `curl`, not just the browser's Elements panel:

```sh
curl -s http://127.0.0.1:5173/
curl -s http://127.0.0.1:5173/puzzle/daily-2026-10-03/
npm run build
# Inspect dist/index.html and dist/puzzle/daily-2026-10-03/index.html
```

The game timer no longer causes periodic renders before Start or after completion. Vite minifies production JS/CSS, fingerprints application assets, and uses native ES modules; source dictionaries and private QA tools are not bundled. No third-party fonts, social SDKs or analytics are downloaded. This remains a static application: HTTP caching/compression and TLS are managed by the hosting provider.

SEO follows visible useful content, unique page titles/descriptions, permanent crawlable URLs, relevant structured data and mobile accessibility. No keyword-stuffing meta tag or fabricated review markup is added. `llms.txt` is an optional documentation aid, not an AI-search requirement or ranking promise. Before launch verify domain ownership, submit the sitemap to Search Console/Bing Webmaster Tools, enforce HTTPS and keep released-page metadata updated through rebuilding.

In development, “Solve puzzle” below Preview date fills the selected puzzle using the existing validators. The normal whole-grid completion effect stops the real timer, shows congratulations and sharing, and saves the result using existing browser storage. If not started, it starts and solves immediately with an approximately zero-second elapsed time; it never fabricates a duration. It is absent from production. Result posts first explain Lingosaic, then state “I solved”, the puzzle/theme/date, actual elapsed time and hints, then invite friends to try and beat that time.

### Information pages and sharing routes

“How to play”, “Privacy & storage”, “Accessibility” and “Terms” are populated static documents generated by `scripts/lib/site.ts`. The Vite `informationRoutes` plugin serves their directory URLs explicitly, avoiding the SPA fallback that previously opened the game instead. Trailing-slash URLs, explicit `index.html` URLs and slashless redirects are tested. Production retains normal directory index files for GitHub Pages.

Only WhatsApp and Twitter social buttons remain, because their share links prefill result text. Sharing is hidden before completion. Private development URLs are still copied accurately; only people on the same network can open them, and crawlers cannot fetch previews. Use the publicly deployed site to test actual public previews.


## Deploy on GitHub Pages

1. Create an empty **public** GitHub repository. The input packs include solutions; they will be readable in this public source repository. Only `dist/` is published as the website.
2. Push this project to its `main` branch.
3. In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
4. In **Actions → Deploy Lingosaic → Run workflow**, run the workflow if the initial push happened before Pages was enabled. No secrets or repository variables are required.
5. Verify `lingosaic.com` in your account/organisation **Settings → Pages**, using the TXT record GitHub supplies.
6. In repository **Settings → Pages**, save **Custom domain: `www.lingosaic.com`** before changing website DNS.
7. Configure DNS: four `A` records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; one `CNAME` for `www` pointing to `OWNER.github.io` (replace OWNER with the repository's GitHub owner, with no repository path). Remove conflicting website records, preserve email records, and use DNS-only if the provider offers proxying.
8. Once GitHub accepts the DNS and provisions its certificate, enable **Enforce HTTPS** in Pages settings. GitHub supplies HTTPS and redirects the apex to the configured `www` domain. No VPS production server or separate redirect service is needed. DNS/certificate readiness may take up to 24 hours.
9. Check `https://www.lingosaic.com/`, `https://lingosaic.com/` (redirect), and a direct puzzle URL such as `/puzzle/daily-2026-10-03/`.

The workflow builds/tests on pushes to `main`, manual runs and daily at 00:17 UTC (scheduled runs may be delayed). The daily build updates release-dependent indexing metadata. It sets the canonical site URL directly to `https://www.lingosaic.com/` and uploads only `dist/`; the inspector and generated private artifacts remain excluded. Add the next puzzle pack before the current pack ends on 2027-01-31.

GitHub references: [Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [custom domain and DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).
