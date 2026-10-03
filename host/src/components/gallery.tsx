"use client";

import Link from "next/link";
import type { MediaItem } from "@/lib/types";

function ratio(item: MediaItem) {
  if (item.width && item.height) return `${item.width} / ${item.height}`;
  return item.mimeType.startsWith("video/") ? "3 / 4" : "1 / 1";
}

function duration(item: MediaItem) {
  if (!item.duration) return "video";
  const total = Math.round(item.duration);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function mergeGallery(fresh: MediaItem[], current: MediaItem[]) {
  if (!fresh.length) return current;
  const known = new Set(current.map((item) => item.id));
  const incoming = new Map(fresh.map((item) => [item.id, item]));
  const prepend = fresh.filter((item) => !known.has(item.id));
  const updated = current.map((item) => incoming.get(item.id) ?? item);
  return [...prepend, ...updated];
}

export function GalleryGrid({
  items,
  hrefFor,
  dense = false,
}: {
  items: MediaItem[];
  hrefFor: (id: string) => string;
  dense?: boolean;
}) {
  if (!items.length) {
    return <p className="muted">No photos yet. The first upload will show up here.</p>;
  }
  return (
    <div className={dense ? "masonry hostgrid" : "masonry"}>
      {items.map((item) => {
        const video = item.mimeType.startsWith("video/");
        return (
          <Link key={item.id} href={hrefFor(item.id)} className="tile" style={{ aspectRatio: ratio(item) }}>
            {item.thumbUrl ? <img src={item.thumbUrl} alt="" /> : <div className="stripes" style={{ height: "100%" }} />}
            {video ? <span className="vid">▶ {duration(item)}</span> : null}
            <span className="meta">{item.contributor?.name || (item.mine ? "You" : "Photo")}</span>
          </Link>
        );
      })}
    </div>
  );
}
