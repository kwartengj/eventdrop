"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeButton } from "@/components/chrome";
import { api } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export default function PosterPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<HostEvent | null>(null);
  useEffect(() => {
    api<{ event: HostEvent }>(`/api/events/${params.id}`).then((data) => setEvent(data.event));
  }, [params.id]);
  if (!event) return <p className="muted" style={{ padding: 24 }}>Loading…</p>;
  return (
    <div className="poster-page">
      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 8 }}>
        <ThemeButton />
        <button className="btn" type="button" onClick={() => window.print()}>
          Print
        </button>
        <a className="btn secondary" href={`/host/events/${event.id}/share`}>
          Back
        </a>
      </div>
      <article className="poster">
        <p className="kicker">SHARE YOUR PHOTOS</p>
        <h1>{event.name}</h1>
        <p>Scan to join the event</p>
        {event.qrDataUrl ? <img className="qr" src={event.qrDataUrl} alt="" /> : null}
        <p className="sharecode" style={{ fontSize: 42 }}>
          {event.joinCode}
        </p>
        <p className="fine">Event code</p>
        <strong>EventDrop</strong>
      </article>
    </div>
  );
}
