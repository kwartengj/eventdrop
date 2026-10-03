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

  return (
    <div className="viewer">
      <header>
        <button className="textbtn" type="button" onClick={onClose} style={{ color: "#f3ede4" }}>
          Close
        </button>
        <span>
          {index + 1} / {items.length}
        </span>
        <a href={item.downloadUrl}>Download</a>
      </header>
      <div className="stage">
        {video ? (
          <video key={item.id} src={item.url} controls autoPlay playsInline />
        ) : (
          <img key={item.id} src={item.url} alt={item.fileName} />
        )}
      </div>
      <footer>
        {prev ? (
          <a id="prev-media" href={hrefFor(prev.id)}>
            Previous
          </a>
        ) : (
          <span />
        )}
        <div style={{ textAlign: "center" }}>
          <div>{item.contributor?.name}</div>
          <div className="fine" style={{ color: "#b3a79b" }}>
            {item.fileName} · {ago(item.uploadedAt)}
            {item.duration ? ` · ${Math.round(item.duration)}s` : ""}
          </div>
          {item.credits && item.credits.length > 1 ? (
            <div className="fine" style={{ color: "#b3a79b" }}>
              Also added by {item.credits.map((credit) => credit.name).join(", ")}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {item.canDelete && onDelete ? (
            <button className="textbtn" type="button" style={{ color: "#f0a397" }} onClick={() => onDelete(item.id)}>
              Delete
            </button>
          ) : null}
          {next ? (
            <a id="next-media" href={hrefFor(next.id)}>
              Next
            </a>
          ) : (
            <span />
          )}
        </div>
      </footer>
    </div>
  );
}
