import { useEffect, useState } from "react";
import { appBaseUrl, type DailyPuzzle, type DailyProgress } from "../lib/daily";
import {
  clipboardText,
  copyResult,
  createResultSharePayload,
  shareResult,
  socialLinks,
  isPrivateShareUrl,
} from "../lib/sharing";

export function ShareControls({
  puzzle,
  progress,
  base = appBaseUrl(),
}: {
  puzzle: DailyPuzzle;
  progress?: DailyProgress;
  base?: URL;
}) {
  const [feedback, setFeedback] = useState("");
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);
  if (!progress || progress.finishedAt === null) return null;
  const payload = createResultSharePayload(puzzle, progress, base);
  const links = socialLinks(payload);
  const copied = (outcome: string) => {
    if (outcome === "copied") {
      setFeedback("✓ Result and puzzle link copied");
      setManual(false);
    } else if (outcome === "shared") setFeedback("Share window opened");
    else if (outcome === "unavailable") setManual(true);
  };
  return (
    <section className="sharing" aria-label="Share your result">
      <h3>You solved it. Share your finish.</h3>
      <p>
        Your time, your hints, no spoilers. Invite someone to beat your time.
      </p>
      <div className="share-preview" aria-label="Your spoiler-free share text">
        <div className="share-preview-brand">
          <img
            src={new URL("favicon.svg", base).href}
            width="36"
            height="36"
            alt=""
          />
          <span>
            lingosaic<small>Daily silhouette word puzzle</small>
          </span>
        </div>
        <p className="share-preview-text">{payload.text}</p>
        <button
          className="primary"
          onClick={async () => copied(await copyResult(payload))}
        >
          Copy my result and puzzle link
        </button>
      </div>
      <div className="share-actions" aria-label="Sharing options">
        {(
          [
            ["whatsapp", "WhatsApp", "◉"],
            ["x", "Twitter", "𝕏"],
          ] as const
        ).map(([key, name, icon]) => (
          <a
            key={key}
            className={`social-share social-${key}`}
            href={links[key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share your result on ${name} (opens in a new tab)`}
          >
            <span className="social-symbol" aria-hidden="true">
              {icon}
            </span>
            {name}
          </a>
        ))}
      </div>
      <p className="share-help">
        WhatsApp and Twitter prepare your complete result text and puzzle link.
      </p>
      {isPrivateShareUrl(payload.url) && (
        <p className="share-help notice" role="note">
          This link uses a private development address (
          {new URL(payload.url).hostname}). Only people on your network can open
          it. The complete post text is still prepared for sharing.
        </p>
      )}
      <p className="share-help">
        Links open a new tab. You choose what to post.
      </p>
      {typeof navigator !== "undefined" &&
        typeof navigator.share === "function" && (
          <button
            className="text-link"
            onClick={async () => copied(await shareResult(payload))}
          >
            More sharing options…
          </button>
        )}
      <p className="feedback" role="status">
        {feedback}
      </p>
      {manual && (
        <label className="manual-copy">
          Copy this post manually
          <textarea
            readOnly
            value={clipboardText(payload)}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </section>
  );
}
