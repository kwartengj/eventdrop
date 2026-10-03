"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api, prettyDate } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export default function HostHomePage() {
  const [events, setEvents] = useState<HostEvent[]>([]);

  useEffect(() => {
    api<{ events: HostEvent[] }>("/api/events").then((data) => setEvents(data.events));
  }, []);

  return (
    <HostFrame>
      <div className="page-head">
        <div>
          <p className="eyebrow">Your events</p>
          <h1>Albums</h1>
        </div>
        <div className="toolbar">
          <Link className="btn" href="/host/events/new">
            Create event
          </Link>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 22 }}>
        {events.length === 0 ? <p className="muted">No events yet. Create one and share the code.</p> : null}
        {events.map((event) => (
          <Link key={event.id} href={`/host/events/${event.id}`} className="card" style={{ textDecoration: "none" }}>
            <div className="row">
              <strong>{event.name}</strong>
              <span className="mono">{event.joinCode}</span>
            </div>
            <p className="fine">
              {prettyDate(event.eventDate)} · {event.counts.photos} photos · {event.counts.videos} videos · {event.counts.contributors} contributors
            </p>
          </Link>
        ))}
      </div>
    </HostFrame>
  );
}
