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
      <div className="stack" style={{ gap: 22 }}>
        <div className="page-head">
          <div className="stack" style={{ gap: 8 }}>
            <span className="live-dot">
              <i />
              {event?.status === "active" ? "Live · uploads open" : event?.status || "Gallery"}
            </span>
            <h1>{event?.name || "Gallery"}</h1>
          </div>
          <div className="toolbar">
            <Link className="btn secondary small" href={`/host/events/${params.id}/share`}>
              Show QR
            </Link>
            <Link className="btn secondary small" href={`/host/events/${params.id}/live`}>
              Live mode
            </Link>
            <Link className="btn small" href={`/host/events/${params.id}/downloads`}>
              Download all
            </Link>
          </div>
        </div>
        {event ? (
          <div className="stats">
            <div className="card stat">
              <b>{event.counts.photos}</b>
              <span>photos</span>
            </div>
            <div className="card stat">
              <b>{event.counts.videos}</b>
              <span>videos</span>
            </div>
            <div className="card stat">
              <b>{event.counts.contributors}</b>
              <span>contributors</span>
            </div>
            <div className="card stat">
              <b style={{ fontSize: 22 }}>{event.quota.label}</b>
              <div className="quota">
                <span style={{ width: `${ratio}%` }} />
              </div>
            </div>
          </div>
        ) : null}
        <div className="dash">
          <div className="stack" style={{ gap: 14 }}>
            <div className="filters">
              <div className="seg">
                {[
                  ["", "All"],
                  ["photo", "Photos"],
                  ["video", "Videos"],
                ].map(([value, label]) => (
                  <button key={label} className={type === value ? "on" : ""} type="button" onClick={() => setType(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filter by date" />
              <input placeholder="Contributor id" value={contributorId} onChange={(event) => setContributorId(event.target.value)} />
            </div>
            <GalleryGrid dense items={items} hrefFor={(id) => `/host/events/${params.id}/view/${id}`} />
          </div>
          <aside className="rail">
            <div className="card stack">
              <b>Activity</b>
              {activity.length === 0 ? <p className="fine">Uploads will show up here.</p> : null}
              {activity.map((row) => (
                <div key={row.id} className="row" style={{ alignItems: "center", justifyContent: "flex-start" }}>
                  <span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                    {(row.name || "?").slice(0, 1)}
                  </span>
                  <div style={{ fontSize: 13 }}>
                    <b>{row.name}</b> {row.fileName}
                    <div className="fine">
                      {row.status} · {ago(row.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {event?.qrDataUrl ? (
              <div className="card row" style={{ justifyContent: "flex-start" }}>
                <img src={event.qrDataUrl} alt="" style={{ width: 64, height: 64, borderRadius: 6 }} />
                <div className="fine">
                  Guests join with
                  <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.08em" }}>
                    {event.joinCode}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </HostFrame>
  );
}
