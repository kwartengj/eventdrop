"use client";

import Link from "next/link";
import type { MediaItem } from "@/lib/types";

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
      {items.map((item) => (
        <Link key={item.id} href={hrefFor(item.id)} className="tile">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt={item.fileName} />
          ) : (
            <div className="stripes" style={{ aspectRatio: "1" }} />
          )}
          <span className="meta">
            {item.mimeType.startsWith("video/") ? "Video" : item.contributor?.name || "Photo"}
          </span>
        </Link>
      ))}
    </div>
  );
}
