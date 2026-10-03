"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { GalleryGrid } from "@/components/gallery";
import { ago, api } from "@/lib/api";
import type { HostEvent, MediaItem } from "@/lib/types";

type Activity = { id: string; fileName: string; mimeType: string; status: string; createdAt: string; name: string };

export default function DashboardPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<HostEvent | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [type, setType] = useState("");
  const [contributorId, setContributorId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    let stop = false;
    async function load() {
      const [eventRes, activityRes] = await Promise.all([
        api<{ event: HostEvent }>(`/api/events/${params.id}`),
        api<{ activity: Activity[] }>(`/api/events/${params.id}/activity`),
      ]);
      if (stop) return;
      setEvent(eventRes.event);
      setActivity(activityRes.activity);
      const query = new URLSearchParams();
      if (type) query.set("type", type);
      if (contributorId) query.set("contributorId", contributorId);
      if (date) query.set("date", date);
      const media = await api<{ items: MediaItem[] }>(`/api/events/${params.id}/media?${query}`);
      if (!stop) setItems(media.items);
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [params.id, type, contributorId, date]);

  const ratio = event ? Math.min(100, (event.quota.usedBytes / event.quota.quotaBytes) * 100) : 0;

  return (
    <HostFrame>
      <div className="row">
        <div>
          <p className="eyebrow">{event?.status}</p>
          <h1 style={{ fontSize: 40 }}>{event?.name || "Gallery"}</h1>
        </div>
        <Link className="btn" href={`/host/events/${params.id}/share`}>
          Share
        </Link>
      </div>
      {event ? (
        <div className="stats" style={{ margin: "18px 0" }}>
          <div className="card stat">
            <b>{event.counts.photos}</b>photos
          </div>
          <div className="card stat">
            <b>{event.counts.videos}</b>videos
          </div>
          <div className="card stat">
            <b>{event.counts.contributors}</b>contributors
          </div>
          <div className="card stat">
            <b style={{ fontSize: 18 }}>{event.quota.label}</b>
            <div className="quota">
              <span style={{ width: `${ratio}%` }} />
            </div>
          </div>
        </div>
      ) : null}
      <div className="filters" style={{ marginBottom: 12 }}>
        {[
          ["", "All"],
          ["photo", "Photos"],
          ["video", "Videos"],
        ].map(([value, label]) => (
          <button key={label} className={type === value ? "chip on" : "chip"} type="button" onClick={() => setType(value)}>
            {label}
          </button>
        ))}
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ width: 160 }} />
        <input
          placeholder="Contributor id"
          value={contributorId}
          onChange={(event) => setContributorId(event.target.value)}
          style={{ maxWidth: 220 }}
        />
      </div>
      <div className="dash">
        <GalleryGrid dense items={items} hrefFor={(id) => `/host/events/${params.id}/view/${id}`} />
        <aside className="card stack">
          <strong>Activity</strong>
          {activity.length === 0 ? <p className="fine">Uploads will show up here.</p> : null}
          {activity.map((row) => (
            <div key={row.id}>
              <div>
                {row.name} · {row.fileName}
              </div>
              <div className="fine">
                {row.status} · {ago(row.createdAt)}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </HostFrame>
  );
}
