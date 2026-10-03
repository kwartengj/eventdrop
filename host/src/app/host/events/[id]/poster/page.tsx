"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export default function PosterPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<HostEvent | null>(null);
  useEffect(() => {
    api<{ event: HostEvent }>(`/api/events/${params.id}`).then((data) => setEvent(data.event));
  }, [params.id]);
  if (!event) return <p className="muted" style={{ padding: 24 }}>Loading…</p>;
  const path = event.joinUrl.replace(/^https?:\/\//, "");
  return (
    <div className="poster-page">
      <div className="poster-stage">
        <article className="poster">
          <p className="kicker">SHARE YOUR PHOTOS</p>
          <h1>
            Scan to join
            <br />
            the event
          </h1>
          <p style={{ color: "#6f655b", marginTop: 14 }}>{event.name}</p>
          <div style={{ marginTop: 30, padding: 16, background: "#fff", borderRadius: 20 }}>
            {event.qrDataUrl ? <img className="qr" src={event.qrDataUrl} alt="" style={{ width: 230, height: 230 }} /> : null}
          </div>
          <p className="fine" style={{ marginTop: 26 }}>
            Event code
          </p>
          <p className="sharecode" style={{ fontSize: 40, color: "#231d17" }}>
            {event.joinCode}
          </p>
          <p className="fine">or visit {path}</p>
          <div style={{ flex: 1 }} />
          <div className="row" style={{ width: "100%", borderTop: "1px solid rgba(70,45,20,.15)", paddingTop: 14, color: "#6f655b", fontSize: 12 }}>
            <span className="brand" style={{ color: "#231d17" }}>
              <span className="dot" style={{ width: 9, height: 9 }} />
              EventDrop
            </span>
            <span>No app or account needed</span>
          </div>
        </article>
      </div>
      <aside className="poster-side no-print">
        <Link href={`/host/events/${event.id}/share`} style={{ fontSize: 13, color: "var(--mute)" }}>
          ← Back
        </Link>
        <h2 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.025em" }}>QR poster</h2>
        <p className="fine">Tested to scan from print, phone screens and projectors. Keep the code at least 6 cm wide when printed.</p>
        <div style={{ flex: 1 }} />
        <button className="btn block" type="button" onClick={() => window.print()}>
          Print poster
        </button>
        <a className="btn secondary block" href={`/api/events/${event.id}/qr`}>
          Download QR
        </a>
      </aside>
    </div>
  );
}
