import {
  appBaseUrl,
  formatDate,
  type DailyPuzzle,
  type DailyProgress,
} from "./daily";
import { elapsedSeconds, formatTime } from "./player";
export interface SharePayload {
  title: string;
  text: string;
  url: string;
}
export function puzzleUrl(id: string, base = appBaseUrl()): string {
  return new URL(`puzzle/${encodeURIComponent(id)}/`, base).href;
}
export function createPuzzleSharePayload(
  puzzle: DailyPuzzle,
  base = appBaseUrl(),
): SharePayload {
  return {
    title: `Daily Lingosaic #${puzzle.daily_number}`,
    text: `Daily Lingosaic #${puzzle.daily_number} 🧩\n${formatDate(puzzle.date)} · ${puzzle.theme.name}\n${puzzle.shape.name}\n\nA daily silhouette word puzzle. One theme, no clues.\nCan you solve it?`,
    url: puzzleUrl(puzzle.id, base),
  };
}
export function createResultSharePayload(
  puzzle: DailyPuzzle,
  progress: DailyProgress,
  base = appBaseUrl(),
): SharePayload {
  if (progress.finishedAt === null)
    throw new Error("Only completed results can be shared");
  return {
    title: `Daily Lingosaic #${puzzle.daily_number}`,
    text: `Lingosaic is a daily silhouette word puzzle: one theme, crossing words, no clues.\n\nI solved #${puzzle.daily_number} · ${puzzle.theme.name}\n${formatDate(puzzle.date)}\nSolved in ${formatTime(elapsedSeconds(progress))} · ${progress.hintsUsed ? `💡 ${progress.hintsUsed} ${progress.hintsUsed === 1 ? "hint" : "hints"}` : "✨ No hints"}\n\nYour turn! Can you beat my time?`,
    url: puzzleUrl(puzzle.id, base),
  };
}
export function clipboardText(payload: SharePayload): string {
  return `${payload.text}\n\n${payload.url}`;
}
export async function copyResult(
  payload: SharePayload,
): Promise<"copied" | "unavailable"> {
  return copyText(clipboardText(payload));
}
export async function copyText(
  value: string,
): Promise<"copied" | "unavailable"> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return "copied";
    }
  } catch {
    /* Older HTTP browsers may still support the selected-text fallback. */
  }
  const text = document.createElement("textarea");
  text.value = value;
  text.setAttribute("aria-label", "Share text to copy");
  text.style.cssText = "position:fixed;top:0;left:-9999px";
  document.body.append(text);
  const focused = document.activeElement as HTMLElement | null;
  try {
    text.select();
    return document.execCommand("copy") ? "copied" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    text.remove();
    focused?.focus();
  }
}
export async function shareResult(
  payload: SharePayload,
): Promise<"shared" | "cancelled" | "copied" | "unavailable"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError")
        return "cancelled";
    }
  }
  return copyResult(payload);
}
export function isPrivateShareUrl(value: string): boolean {
  const host = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "::" ||
    /^(?:fc|fd)[a-f0-9]{2}:|^fe[89ab][a-f0-9]:/.test(host)
  )
    return true;
  const parts = host.split(".").map(Number);
  return (
    parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 169 && parts[1] === 254))
  );
}
export function socialLinks(payload: SharePayload) {
  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(payload.text)}&url=${encodeURIComponent(payload.url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(clipboardText(payload))}`,
  };
}
