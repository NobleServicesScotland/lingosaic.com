import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createRoot } from "react-dom/client";
import { isComplete, parseShape } from "./lib/puzzle";
import { elapsedSeconds, formatTime, nextCell } from "./lib/player";
import {
  appBaseUrl,
  applyHint,
  exampleGrid,
  formatDate,
  hintTarget,
  parseDailyPuzzle,
  previousDate,
  selectDate,
  type CatalogEntry,
  type DailyPuzzle,
  type DailyProgress,
} from "./lib/daily";
import { dailyStorageKey, loadDailyProgress } from "./lib/daily-progress";
import { ShareControls } from "./components/ShareControls";
import { PuzzleGrid } from "./components/PuzzleGrid";
import { SolutionView } from "./components/SolutionView";
import { SITE_INTRODUCTION, PLAY_RULES } from "./lib/site-content";
import "./style.css";
async function fetchPuzzle(date: string): Promise<DailyPuzzle> {
  const response = await fetch(new URL(`puzzles/${date}.json`, appBaseUrl()));
  if (!response.ok)
    throw new Error(`Puzzle request failed (${response.status})`);
  return parseDailyPuzzle(await response.json());
}
function ExampleModal({
  puzzle,
  letters,
  onClose,
}: {
  puzzle: DailyPuzzle;
  letters: Record<string, string>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label="Yesterday’s solved puzzle"
    >
      <button
        className="close-modal"
        onClick={() => dialog.current?.close()}
        aria-label="Close example"
      >
        Close ×
      </button>
      <SolutionView puzzle={puzzle} letters={letters} mode="example" />
    </dialog>
  );
}
function Player({
  puzzle,
  initial,
  catalog,
  storageAvailable,
  developerSolve,
}: {
  puzzle: DailyPuzzle;
  initial: DailyProgress;
  catalog: CatalogEntry[];
  storageAvailable: boolean;
  developerSolve?: RefObject<(() => Promise<void>) | null>;
}) {
  const layout = useMemo(() => parseShape(puzzle.shape), [puzzle]);
  const [progress, setProgress] = useState(initial),
    [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(() => {
    try {
      return localStorage.getItem("lingosaic:save-progress") !== "false";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const update = () => {
      try {
        setSaving(localStorage.getItem("lingosaic:save-progress") !== "false");
      } catch {
        setSaving(false);
      }
    };
    window.addEventListener("lingosaic-storage-change", update);
    return () => window.removeEventListener("lingosaic-storage-change", update);
  }, []);
  const [warning, setWarning] = useState(!storageAvailable),
    [error, setError] = useState("");
  const [example, setExample] = useState<{
      puzzle: DailyPuzzle;
      letters: Record<string, string>;
    }>(),
    [loadingExample, setLoadingExample] = useState(false);
  const exampleTrigger = useRef<HTMLButtonElement>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>()),
    direction = useRef<"across" | "down">("across");
  const grid = useMemo(
    () => ({ ...progress.letters, ...puzzle.seeds }),
    [progress.letters, puzzle],
  );
  const started = progress.startedAt !== null,
    complete = progress.finishedAt !== null;
  useEffect(() => {
    if (!import.meta.env.DEV || !developerSolve) return;
    let active = true;
    developerSolve.current = async () => {
      const solution = await exampleGrid(puzzle);
      if (!active) return;
      const time = Date.now();
      setNow(time);
      setProgress((current) =>
        current.finishedAt !== null
          ? current
          : {
              ...current,
              letters: Object.fromEntries(
                Object.entries(solution).filter(
                  ([cell]) => !puzzle.seeds[cell],
                ),
              ),
              startedAt: current.startedAt ?? time,
            },
      );
      // The existing completion effect validates the filled grid and records finish time.
    };
    return () => {
      active = false;
      developerSolve.current = null;
    };
  }, [puzzle, developerSolve]);
  const yesterday = catalog.find(
    (entry) => entry.date === previousDate(puzzle.date),
  );
  useEffect(() => {
    if (!started || complete) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [started, complete]);
  useEffect(() => {
    if (!saving || progress.startedAt === null) return;
    try {
      localStorage.setItem(dailyStorageKey(puzzle), JSON.stringify(progress));
    } catch {
      setWarning(true);
    }
  }, [puzzle, progress, saving]);
  useEffect(() => {
    let active = true;
    if (started && !complete && layout.cells.every((cell) => grid[cell])) {
      const finishedAt = Date.now();
      isComplete(puzzle, grid)
        .then((valid) => {
          if (active && valid)
            setProgress((current) => ({ ...current, finishedAt }));
        })
        .catch(() => {
          if (active)
            setError(
              "Completion checking failed. Your entries are saved; try reloading.",
            );
        });
    }
    return () => {
      active = false;
    };
  }, [grid, puzzle, layout, started, complete]);
  const focus = (cell: number | undefined) => {
    if (cell !== undefined) {
      inputs.current.get(cell)?.focus();
      inputs.current.get(cell)?.select();
    }
  };
  useEffect(() => {
    if (started && !complete)
      focus(
        layout.cells.find(
          (cell) => !puzzle.seeds[cell] && !progress.hintCells.includes(cell),
        ),
      );
  }, [started]);
  const locked = (cell: number) =>
    !!puzzle.seeds[cell] || progress.hintCells.includes(cell);
  const advance = (cell: number, backward = false) => {
    const slot = layout.slots.find(
      (slot) =>
        slot.direction === direction.current && slot.cells.includes(cell),
    );
    if (!slot) return;
    const index = slot.cells.indexOf(cell),
      rest = backward
        ? slot.cells.slice(0, index).reverse()
        : slot.cells.slice(index + 1);
    focus(rest.find((cell) => !locked(cell)));
  };
  const edit = (cell: number, value: string) => {
    if (!started || complete || locked(cell)) return;
    setProgress((current) => {
      const letters = { ...current.letters };
      if (value) letters[cell] = value;
      else delete letters[cell];
      return { ...current, letters };
    });
    if (value) advance(cell);
  };
  const keyDown = (cell: number, event: KeyboardEvent<HTMLInputElement>) => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dx, dy] = arrows[event.key];
      direction.current = dx ? "across" : "down";
      focus(nextCell(puzzle.shape.rows, cell, dx, dy));
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (!locked(cell)) {
        if (event.key === "Backspace" && !grid[cell]) advance(cell, true);
        else edit(cell, "");
      }
    } else if (
      /^[a-zA-Z]$/.test(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      edit(cell, event.key.toUpperCase());
    }
  };
  const openExample = async () => {
    if (!yesterday) return;
    setLoadingExample(true);
    setError("");
    try {
      const previous = await fetchPuzzle(yesterday.date);
      setExample({ puzzle: previous, letters: await exampleGrid(previous) });
    } catch {
      setError("The example could not be loaded. Please try again.");
    } finally {
      setLoadingExample(false);
    }
  };
  const remaining = 3 - progress.hintsUsed;
  return (
    <>
      {!started ? (
        <section className="puzzle-card welcome">
          <p className="eyebrow">One shape. One theme. Your daily discovery.</p>
          <h2>{puzzle.theme.name}</h2>
          <p className="description">{puzzle.description}</p>
          <button
            className="primary start-button"
            onClick={() => {
              const time = Date.now();
              setProgress((current) => ({ ...current, startedAt: time }));
              setNow(time);
            }}
          >
            Start puzzle →
          </button>
          <p className="save-disclosure">
            Playing saves progress on this browser when saving is enabled.
            Change this in the footer.{" "}
            <a href={new URL("privacy/", appBaseUrl()).href}>
              Privacy &amp; storage
            </a>
          </p>
        </section>
      ) : complete ? (
        <SolutionView
          puzzle={puzzle}
          letters={grid}
          hintCells={progress.hintCells}
          hintsUsed={progress.hintsUsed}
          elapsed={elapsedSeconds(progress, now)}
        >
          <ShareControls puzzle={puzzle} progress={progress} />
        </SolutionView>
      ) : (
        <section className="puzzle-card playing">
          <div className="play-heading">
            <div>
              <p className="eyebrow">
                #{puzzle.daily_number} · {puzzle.shape.name}
              </p>
              <h2>{puzzle.theme.name}</h2>
            </div>
            <div className="timer">
              <span>Time</span>
              <strong>{formatTime(elapsedSeconds(progress, now))}</strong>
            </div>
          </div>
          <p className="description">{puzzle.description}</p>
          <p className="instructions">
            Fill every playable cell with words from the theme, across and down.
            Each word is used only once. Underlined letters are fixed; dotted
            letters came from hints.
          </p>
          <PuzzleGrid
            puzzle={puzzle}
            letters={grid}
            hintCells={progress.hintCells}
            editable
            inputRef={(cell) => (node) => {
              if (node) inputs.current.set(cell, node);
              else inputs.current.delete(cell);
            }}
            onFocus={(cell) => {
              if (
                !layout.slots.some(
                  (slot) =>
                    slot.direction === direction.current &&
                    slot.cells.includes(cell),
                )
              )
                direction.current =
                  layout.slots.find((slot) => slot.cells.includes(cell))
                    ?.direction ?? "across";
            }}
            onEdit={edit}
            onKeyDown={keyDown}
          />
          <div className="play-footer">
            <button
              className={`hint-button remaining-${remaining}`}
              disabled={hintTarget(puzzle, progress) === undefined}
              onClick={() =>
                setProgress((current) => applyHint(puzzle, current))
              }
            >
              💡 Hint: whole word · {remaining} left ·{" "}
              {Math.round((remaining / 3) * 100)}%
            </button>
            <span className="save-note">
              {warning || !saving
                ? "Session only"
                : "Progress saved on this browser"}
            </span>
          </div>
          <p className="feedback" role="status">
            {layout.cells.every((cell) => grid[cell])
              ? "The grid is full, but it is not solved yet. Keep exploring."
              : "Click a cell and type. Arrow keys move; Backspace clears."}
          </p>
        </section>
      )}
      <div className="below-puzzle">
        {yesterday && (
          <button
            ref={exampleTrigger}
            className="text-link"
            disabled={loadingExample}
            onClick={openExample}
          >
            {loadingExample ? "Loading example…" : "Example ↗"}
          </button>
        )}
        <span>Every crossing counts.</span>
      </div>
      {warning && (
        <p role="status" className="notice">
          Local storage is unavailable. Keep this page open to retain your
          progress.
        </p>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {example && (
        <ExampleModal
          {...example}
          onClose={() => {
            setExample(undefined);
            exampleTrigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
function StorageControls({ onClear }: { onClear: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("lingosaic:save-progress") !== "false";
    } catch {
      return false;
    }
  });
  const [error, setError] = useState("");
  return (
    <div className="storage-controls">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            try {
              const value = event.currentTarget.checked;
              localStorage.setItem("lingosaic:save-progress", String(value));
              setEnabled(value);
              window.dispatchEvent(new Event("lingosaic-storage-change"));
            } catch {
              setError("Browser storage settings could not be saved.");
            }
          }}
        />{" "}
        Save progress on this browser
      </label>
      <p>
        When disabled, new changes last only for this session. Existing saves
        can be deleted below.
      </p>
      {!confirm ? (
        <button className="text-link" onClick={() => setConfirm(true)}>
          Delete saved puzzle data
        </button>
      ) : (
        <>
          <p>
            Delete all Lingosaic entries, hints and results saved on this
            browser?
          </p>
          <button
            onClick={() => {
              try {
                for (const key of Object.keys(localStorage))
                  if (key.startsWith("lingosaic:"))
                    localStorage.removeItem(key);
                onClear();
              } catch {
                setError(
                  "Browser storage could not be cleared. You can remove it in your browser settings.",
                );
              }
            }}
          >
            Delete saved data
          </button>
          <button onClick={() => setConfirm(false)}>Keep my data</button>
        </>
      )}
      <p role="status">{error}</p>
    </div>
  );
}
function App() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]),
    [date, setDate] = useState<string>(),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<{
    puzzle: DailyPuzzle;
    initial: DailyProgress;
    storageAvailable: boolean;
  }>();
  const developerSolve = useRef<(() => Promise<void>) | null>(null);
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch(new URL("puzzles/index.json", appBaseUrl()));
      if (!response.ok) throw new Error("Puzzle calendar could not be loaded");
      const entries: CatalogEntry[] = await response.json();
      const pathId = window.location.pathname.match(
        /\/puzzle\/([^/]+)\/?$/,
      )?.[1];
      const requested = pathId
        ? decodeURIComponent(pathId)
        : new URLSearchParams(window.location.search).get("puzzle");
      if (active) {
        setCatalog(entries);
        setDate(selectDate(entries, today, import.meta.env.DEV, requested));
        setReady(true);
      }
    })().catch((error) => {
      if (active) {
        setError(error.message);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [today]);
  useEffect(() => {
    let active = true;
    setLoaded(undefined);
    setError("");
    if (date)
      fetchPuzzle(date)
        .then(async (puzzle) => {
          const state = await loadDailyProgress(puzzle);
          if (active)
            setLoaded({
              puzzle,
              initial: state.progress,
              storageAvailable: state.storageAvailable,
            });
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
    return () => {
      active = false;
    };
  }, [date]);
  return (
    <>
      <a className="skip-link" href="#puzzle-content">
        Skip to puzzle
      </a>
      <main className="site-shell" id="puzzle-content" tabIndex={-1}>
        <header className="site-header">
          <h1 className="brand-heading">
            <a className="brand" href={appBaseUrl().href}>
              lingosaic<span>Daily</span>
            </a>
          </h1>
          <p>{date ? formatDate(date) : "A little discovery, every day."}</p>
        </header>
        <p className="site-introduction">
          The daily silhouette word puzzle. One theme, crossing words, no
          individual clues.{" "}
          <a href={new URL("how-to-play/", appBaseUrl()).href}>How to play</a>
        </p>
        {import.meta.env.DEV && (
          <div className="development-tools">
            <div className="preview-date-controls">
              <label>
                Preview date{" "}
                <select
                  aria-label="Preview puzzle date"
                  value={date ?? ""}
                  onChange={(event) => setDate(event.target.value)}
                >
                  {catalog.map((entry) => (
                    <option key={entry.date} value={entry.date}>
                      {entry.date} · {entry.theme}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!loaded || loaded.puzzle.date !== date || solving}
                onClick={async () => {
                  if (!developerSolve.current) return;
                  setSolving(true);
                  setSolveError("");
                  try {
                    await developerSolve.current();
                  } catch {
                    setSolveError(
                      "The preview puzzle could not be solved. Please try again.",
                    );
                  } finally {
                    setSolving(false);
                  }
                }}
              >
                {solving ? "Solving…" : "Solve puzzle"}
              </button>
              {solveError && <p role="alert">{solveError}</p>}
            </div>
            {["localhost", "127.0.0.1"].includes(window.location.hostname) && (
              <a
                href="http://127.0.0.1:5174/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Developer inspector ↗
              </a>
            )}
          </div>
        )}
        {loaded ? (
          <Player
            key={loaded.puzzle.id}
            {...loaded}
            catalog={catalog}
            developerSolve={import.meta.env.DEV ? developerSolve : undefined}
          />
        ) : (
          <section className="puzzle-card welcome">
            <h2>
              {error
                ? "Something went wrong"
                : !ready || date
                  ? "Getting your puzzle ready…"
                  : "A new daily discovery is on its way"}
            </h2>
            <p role="status">
              {error ||
                (ready && !date
                  ? `Daily Lingosaic runs from ${catalog[0] ? formatDate(catalog[0].date) : "the first scheduled date"} to ${catalog.at(-1) ? formatDate(catalog.at(-1)!.date) : "the last scheduled date"}. There is no puzzle published for today.`
                  : "Loading…")}
            </p>
          </section>
        )}
        <section
          className="about-lingosaic"
          aria-labelledby="about-lingosaic-title"
        >
          <h2 id="about-lingosaic-title">What is Lingosaic?</h2>
          <p>{SITE_INTRODUCTION}</p>
          <h3>How to solve the daily puzzle</h3>
          <p>{PLAY_RULES}</p>
          <p>
            Helping letters are already filled in at different positions within
            the words and stay fixed. You have three optional whole-word hints.
            Press Start to begin timing; the timer stops when your complete grid
            is correct. Save progress on this browser and share your finish
            without revealing the words.
          </p>
          <a href={new URL("how-to-play/", appBaseUrl()).href}>
            Read the full Lingosaic rules →
          </a>
        </section>
        <footer className="site-footer">
          <p>A silhouette. Shared letters. One satisfying finish.</p>
          <nav aria-label="Site information">
            {[
              ["how-to-play/", "How to play"],
              ["privacy/", "Privacy & storage"],
              ["accessibility/", "Accessibility"],
              ["terms/", "Terms"],
            ].map(([path, label]) => (
              <a key={path} href={new URL(path, appBaseUrl()).href}>
                {label}
              </a>
            ))}
          </nav>
          <StorageControls onClear={() => window.location.reload()} />
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
