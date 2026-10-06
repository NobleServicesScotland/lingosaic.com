# Lingosaic Daily — dense set

Period: **3 October 2026 – 31 January 2027**  
Puzzles: **121**

Each day contains:

- `shapes/` — theme-matched silhouette as `.grid.json` and SVG
- `dictionaries/` — 100-word approved source dictionary
- `puzzles/` — public playable puzzle JSON
- `solutions/` — private answer/QA JSON
- `validation/` — per-puzzle validation report

## Dense topology requirements

Puzzles use a connected across/down crossword network rather than a single spine word.

Combined QA:

- unique solutions: **121 / 121**
- slots per puzzle: **12–18** (average 15.64)
- crossings per puzzle: **12–21** (average 16.65)
- seed letters: **0–10** (average 4.1)
- solution hashes verified: **121 / 121**
- solution answers present in corresponding dictionaries: **121 / 121**
- public `answer` fields: **0**

## Grid legend

- `#` — outside silhouette
- `*` — stop block inside silhouette
- `.` — editable puzzle cell
- `A-Z` — fixed seed letter

`solutions/` and `validation/` are development/private material and should never be copied into the public web root.
