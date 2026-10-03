"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MediaItem } from "@/lib/types";

export default function LivePage() {
  const params = useParams<{ id: string }>();
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      const data = await api<{ enabled: boolean; items: MediaItem[] }>(`/api/events/${params.id}/live`);
      if (stop) return;
      setEnabled(data.enabled);
      setItems((current) => {
        if (data.items.length > current.length) setIndex(0);
        return data.items;
      });
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [params.id]);

  useEffect(() => {
    if (!enabled || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 5000);
    return () => window.clearInterval(timer);
  }, [enabled, items.length]);

  const item = items[index];

  return (
    <div className="live">
      <div className="live-controls">
        <button
          className="btn small"
          type="button"
          onClick={async () => {
            const data = await api<{ enabled: boolean }>(`/api/events/${params.id}/live`, {
              method: "POST",
              body: JSON.stringify({ enabled: !enabled }),
            });
            setEnabled(data.enabled);
          }}
        >
          {enabled ? "Disable live mode" : "Enable live mode"}
        </button>
        <a className="btn secondary small" href={`/host/events/${params.id}`}>
          Exit
        </a>
      </div>
      {!enabled ? <p>Live mode is off. Turn it on for a projector slideshow.</p> : null}
      {enabled && !item ? <p>Waiting for the first photo.</p> : null}
      {enabled && item ? (
        item.mimeType.startsWith("video/") ? (
          <video key={item.id} src={item.url} autoPlay muted playsInline />
        ) : (
          <img key={item.id} src={item.url} alt={item.fileName} />
        )
      ) : null}
    </div>
  );
}
