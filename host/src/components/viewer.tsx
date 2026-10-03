"use client";

import { useEffect } from "react";
import type { MediaItem } from "@/lib/types";
import { ago } from "@/lib/api";

export function Viewer({
  items,
  mediaId,
  onClose,
  onDelete,
  hrefFor,
}: {
  items: MediaItem[];
  mediaId: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  hrefFor: (id: string) => string;
}) {
  const index = Math.max(0, items.findIndex((item) => item.id === mediaId));
  const item = items[index];
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") document.getElementById("next-media")?.click();
      if (event.key === "ArrowLeft") document.getElementById("prev-media")?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return <p className="muted">That file is not in the gallery.</p>;
  const prev = items[index - 1];
  const next = items[index + 1];
  const video = item.mimeType.startsWith("video/");
  const who = item.contributor?.name || "Guest";

  return (
    <div className="viewer">
      <div style={{ height: 12 }} />
      <header>
        <button className="round" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span style={{ fontWeight: 600, opacity: 0.8 }}>
          {index + 1} / {items.length}
        </span>
        <a className="round" href={item.downloadUrl} aria-label="Download">
          ↓
        </a>
      </header>
      <div className="stage">
        {video ? <video key={item.id} src={item.url} controls autoPlay playsInline /> : <img key={item.id} src={item.url} alt="" />}
        {prev ? (
          <a id="prev-media" className="round" href={hrefFor(prev.id)} style={{ position: "absolute", left: 12 }}>
            ←
          </a>
        ) : null}
        {next ? (
          <a id="next-media" className="round" href={hrefFor(next.id)} style={{ position: "absolute", right: 12 }}>
            →
          </a>
        ) : null}
      </div>
      <footer>
        <span className="avatar">{who.slice(0, 1)}</span>
        <div style={{ flex: 1 }}>
          <b>{who}</b>
          <div style={{ fontSize: 13, opacity: 0.65 }}>{ago(item.uploadedAt) || "Just now"}</div>
          {item.credits && item.credits.length > 1 ? (
            <div style={{ fontSize: 13, opacity: 0.65 }}>Also added by {item.credits.map((credit) => credit.name).join(", ")}</div>
          ) : null}
        </div>
        {item.canDelete && onDelete ? (
          <button type="button" onClick={() => onDelete(item.id)} style={{ border: 0, background: "rgba(255,255,255,.08)", color: "oklch(0.75 0.14 28)", fontWeight: 600, borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>
            Delete
          </button>
        ) : (
          <span />
        )}
      </footer>
    </div>
  );
}
