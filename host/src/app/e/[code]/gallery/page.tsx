"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GuestFrame } from "@/components/chrome";
import { GalleryGrid, mergeGallery } from "@/components/gallery";
import { api } from "@/lib/api";
import type { MediaItem, PublicEvent } from "@/lib/types";

export default function GuestGalleryPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [closed, setClosed] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<"all" | "photo" | "video" | "mine">("all");
  const [name, setName] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    api<{ event: PublicEvent; joined: boolean; displayName: string | null }>(`/api/join/${params.code}`, {}, "guest").then((data) => {
      if (!data.joined) {
        router.replace(`/e/${params.code}`);
        return;
      }
      setEvent(data.event);
      if (data.displayName && data.displayName !== "Guest") setName(data.displayName);
    });
  }, [params.code, router]);

  useEffect(() => {
    if (!event) return;
    let stop = false;
    let cursor = "";
    async function load() {
      const query = new URLSearchParams();
      if (filter === "photo" || filter === "video") query.set("type", filter);
      if (cursor) query.set("since", cursor);
      const data = await api<{ items: MediaItem[]; galleryClosed: boolean }>(
        `/api/events/${event!.id}/media?${query}`,
        {},
        "guest",
      );
      if (stop) return;
      setClosed(data.galleryClosed);
      const visible = filter === "mine" ? data.items.filter((item) => item.mine) : data.items;
      const newest = data.items.find((item) => item.uploadedAt)?.uploadedAt;
      if (!cursor) setItems(visible);
      else setItems((current) => mergeGallery(visible, current));
      if (newest && (!cursor || newest > cursor)) cursor = newest;
      const fresh = data.items.filter((item) => !seen.current.has(item.id) && !item.mine);
      if (primed.current && fresh.length) {
        const who = fresh[0]?.contributor?.name || "Someone";
        const photos = fresh.filter((item) => item.mimeType.startsWith("image/")).length;
        setToast(photos === fresh.length ? `${who} added ${photos} photos` : `${who} added ${fresh.length} items`);
        window.setTimeout(() => setToast(""), 2800);
      }
      for (const item of data.items) seen.current.add(item.id);
      primed.current = true;
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [event, filter]);

  return (
    <GuestFrame>
      <div className="guest-head">
        <div className="row">
          <div className={event?.coverUrl ? "thumb" : "thumb stripes"}>{event?.coverUrl ? <img src={event.coverUrl} alt="" /> : null}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{event?.name || "Gallery"}</div>
            <div className="fine">{name ? `Hi ${name}` : "Guests sharing"}</div>
          </div>
          <span className="live-dot">
            <i />
            Live
          </span>
        </div>
        <div className="tabs">
          <Link href={`/e/${params.code}/upload`}>Add</Link>
          <Link className="on" href={`/e/${params.code}/gallery`}>
            Gallery · {items.length}
          </Link>
        </div>
      </div>
      <div className="chips">
        {(
          [
            ["all", "All"],
            ["photo", "Photos"],
            ["video", "Videos"],
            ["mine", "Mine"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} className={filter === value ? "chip on" : "chip"} type="button" onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      {toast ? (
        <div className="toast">
          <span>
            <i className="pulse" style={{ background: "var(--accent)" }} />
            {toast}
          </span>
        </div>
      ) : null}
      {closed ? <p style={{ padding: 20 }}>This gallery is no longer available.</p> : <GalleryGrid items={items} hrefFor={(id) => `/e/${params.code}/view/${id}`} />}
    </GuestFrame>
  );
}
