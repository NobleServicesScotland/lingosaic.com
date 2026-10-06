# Lingosaic domain rules

- Lingosaic is a themed silhouette crossword-like puzzle without individual clues.
- Slots are every maximal horizontal or vertical playable run of length >= 3.
- Entries are alphabetic English single words from the supplied approved theme dictionary. Never invent, truncate, or stem entries.
- Crossings must agree; no word may be repeated within a solution.
- Generation is deterministic for the supplied seed, inputs, generator version, and options.
- Every generated puzzle must have exactly one solution with its approved dictionary and seed letters. Add target seed letters to remove ambiguity.
- Fail explicitly rather than silently violating any rule. Safeguards must fail, not imply uniqueness.
- Keep generator/solver logic separate from presentation logic.
- Public puzzle data must omit plaintext solutions; private debug artifacts stay outside public/.

## Public/private architecture

- PUBLIC: playable puzzle data and UI only. Retain the spoiler-light completion hash.
- PRIVATE: solutions, answer words, QA reports, and developer inspection. Store artifacts under `private/solutions/` and `private/reports/`; `private/` stays gitignored.
- Never expose `private/` through the production application or normal Vite dev server. The developer inspector binds to `0.0.0.0` for access through this VPS IP, as explicitly requested by the user. It lives outside the public app and is excluded from production builds.
- The developer-inspector link requires both development mode and a localhost/127.0.0.1 browser host. Production output must contain neither the link nor inspector URL/UI.
- Dictionary creation is separate from puzzle generation. Consume an already approved `.word-list.json`; never call an LLM to invent entries while filling. The demo pipeline stays offline and deterministic.
- `npm run build` must pass the production public/private boundary check. Do not relax it to accommodate a leak.

## Daily pack and player

- Import the supplied daily pack using `npm run prepare:daily`; keep original inputs intact and verify each fill with the existing solver before publication.
- The active dense pack is `puzzles/lingosaic-daily-dense-2026-10-03_to_2027-01-31`; its manifest controls the calendar. Source schema 2 uses `#` outside the silhouette, `*` for internal stop blocks, and dots/A–Z seed letters for playable cells (legacy schema 1 used `X` stop blocks). Preserve the full silhouette separately from the solver mask; stop blocks never become letter inputs or word slots.
- Public daily payloads retain the whole-grid completion hash and add per-cell hashes for the explicitly requested three hints and yesterday's solved example. Plaintext solution artifacts remain private. Static client hashes are recoverable, not anti-cheat protection.
- Start starts the persisted wall-clock timer. Save entries, hint cells, start and finish timestamps per puzzle; completion must still match the whole-grid hash. Never share solution letters or words in result text.
- Only development mode shows the date switcher and inspector link. The inspector now browses all solved daily puzzles using the same SolutionView/PuzzleGrid components as the player and example modal.
- `./lingosaic.sh start|stop|state` manages detached development servers on ports 5173 and 5174. It may stop only its own recorded process group.

## Sharing, hints and public discovery

- A hint reveals one entire extracted word slot, not one letter. Track `hintsUsed` separately from distinct locked `hintCells`; preserve older single-letter saves when restoring them. Maximum three uses.
- Show sharing controls only after hash-validated completion, as requested by the user. Offer the complete result-plus-link copy and only social links that prefill post text (WhatsApp/Twitter). The challenge payload API may remain reusable but is not shown in the player. Keep payload formatting in `src/lib/sharing.ts`. Native cancellation is normal; clipboard fallback must remain usable on HTTP development hosts.
- Generate search content, canonical/Open Graph/Twitter metadata and structured data in raw static HTML. Never include solution data in SEO content, sitemap or llms.txt. Future puzzle pages are noindex until a new build after release.
- Privacy disclosures must reflect real storage and hosting, without requiring operator/contact build variables. Never invent legal identities, compliance certifications, reviews or ratings. No trackers or social SDKs.

- Daily imports must give every slot at least one fixed starting letter, preserving supplied seeds. Add letters from the verified target fill; prefer crossings that cover multiple unseeded slots, with deterministic ties. Recheck uniqueness with the final published seeds. These starting letters do not consume the three player hints.

- Keep the Lingosaic explanation visible after React starts. Source HTML, development responses and static production pages need actual head metadata, not DOM-only injection; development responses must remain noindex. Shared copy lives in `src/lib/site-content.ts`, metadata serialization in `scripts/lib/site.ts`.

## Deployment

- Use a free public GitHub repository and GitHub Actions to build and deploy only `dist/` to Pages. Source puzzle packs (including answers) are intentionally public in the repository; generated private QA artifacts remain gitignored.
- The primary production address is `https://www.lingosaic.com/`. No contact details or repository variables are required for deployment.
