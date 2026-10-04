"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api, ApiError, prettyDate } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export default function HostHomePage() {
  const [events, setEvents] = useState<HostEvent[]>([]);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ events: HostEvent[] }>("/api/events").then((data) => setEvents(data.events));
  }, []);

  async function remove(event: HostEvent) {
    if (!window.confirm(`Delete "${event.name}"? The join code stops working and every photo in it is removed. This cannot be undone.`)) {
      return;
    }
    setPending(event.id);
    setError("");
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      setEvents((current) => current.filter((item) => item.id !== event.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the event");
    } finally {
      setPending("");
    }
  }

  return (
    <HostFrame>
      <div className="row">
        <div>
          <p className="eyebrow">Your events</p>
          <h1 style={{ fontSize: 42 }}>Albums</h1>
        </div>
        <Link className="btn" href="/host/events/new">
          Create event
        </Link>
      </div>
      {error ? <p className="bad">{error}</p> : null}
      <div className="stack" style={{ marginTop: 22 }}>
        {events.length === 0 ? <p className="muted">No events yet. Create one and share the code.</p> : null}
        {events.map((event) => (
          <div key={event.id} className="card stack">
            <Link href={`/host/events/${event.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="row">
                <strong>{event.name}</strong>
                <span className="mono">{event.joinCode}</span>
              </div>
              <p className="fine">
                {prettyDate(event.eventDate)} · {event.counts.photos} photos · {event.counts.videos} videos · {event.counts.contributors} contributors
              </p>
            </Link>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn danger small" type="button" disabled={pending === event.id} onClick={() => void remove(event)}>
                {pending === event.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </HostFrame>
  );
}
