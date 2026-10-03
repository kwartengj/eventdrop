"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GuestFrame } from "@/components/chrome";
import { GalleryGrid } from "@/components/gallery";
import { api } from "@/lib/api";
import type { Contributor, MediaItem, PublicEvent } from "@/lib/types";

export default function GuestGalleryPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [closed, setClosed] = useState(false);
  const [toast, setToast] = useState("");
  const [type, setType] = useState("");
  const [contributorId, setContributorId] = useState("");
  const [date, setDate] = useState("");
  const [people, setPeople] = useState<Contributor[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    api<{ event: PublicEvent; joined: boolean }>(`/api/join/${params.code}`, {}, "guest").then(async (data) => {
      if (!data.joined) {
        router.replace(`/e/${params.code}`);
        return;
      }
      setEvent(data.event);
      if (data.event.showContributorNames) {
        const listed = await api<{ contributors: Contributor[] }>(`/api/events/${data.event.id}/contributors`).catch(() => null);
        if (listed) setPeople(listed.contributors);
      }
    });
  }, [params.code, router]);

  useEffect(() => {
    if (!event) return;
    let stop = false;
    async function load() {
      const query = new URLSearchParams();
      if (type) query.set("type", type);
      if (contributorId) query.set("contributorId", contributorId);
      if (date) query.set("date", date);
      const data = await api<{ items: MediaItem[]; galleryClosed: boolean }>(
        `/api/events/${event!.id}/media?${query}`,
        {},
        "guest",
      );
      if (stop) return;
      setClosed(data.galleryClosed);
      setItems(data.items);
      const fresh = data.items.filter((item) => !seen.current.has(item.id) && !item.mine);
      if (primed.current && fresh.length) {
        const name = fresh[0]?.contributor?.name || "Someone";
        const photos = fresh.filter((item) => item.mimeType.startsWith("image/")).length;
        setToast(photos === fresh.length ? `${name} uploaded ${photos} photos` : `${name} added ${fresh.length} items`);
        window.setTimeout(() => setToast(""), 4000);
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
  }, [event, type, contributorId, date]);

  return (
    <GuestFrame>
      <div className="row">
        <div>
          <p className="eyebrow">Gallery</p>
          <h1 style={{ fontSize: 32 }}>{event?.name || "Gallery"}</h1>
        </div>
        <Link className="textbtn" href={`/e/${params.code}`}>
          Event
        </Link>
      </div>
      <div className="filters">
        {[
          ["", "All"],
          ["photo", "Photos"],
          ["video", "Videos"],
        ].map(([value, label]) => (
          <button key={label} className={type === value ? "chip on" : "chip"} type="button" onClick={() => setType(value)}>
            {label}
          </button>
        ))}
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ width: 150 }} />
      </div>
      {people.length ? (
        <select value={contributorId} onChange={(event) => setContributorId(event.target.value)}>
          <option value="">Everyone</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      ) : null}
      {closed ? <p>This gallery is no longer available.</p> : <GalleryGrid items={items} hrefFor={(id) => `/e/${params.code}/view/${id}`} />}
      {toast ? <div className="toast">{toast}</div> : null}
      <div className="dock">
        <Link className="btn block" href={`/e/${params.code}/upload`}>
          Add Photos
        </Link>
      </div>
    </GuestFrame>
  );
}
