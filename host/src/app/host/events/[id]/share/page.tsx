"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<HostEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ event: HostEvent }>(`/api/events/${params.id}`).then((data) => setEvent(data.event));
  }, [params.id]);

  if (!event) {
    return (
      <HostFrame>
        <p className="muted">Loading…</p>
      </HostFrame>
    );
  }

  return (
    <HostFrame>
      <p className="eyebrow">Event created</p>
      <h1 style={{ fontSize: 42 }}>{event.name}</h1>
      <div className="split" style={{ marginTop: 22 }}>
        <div className="card stack">
          <p className="eyebrow">Join code</p>
          <p className="sharecode">{event.joinCode}</p>
          <p className="fine">{event.joinUrl}</p>
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(event.joinUrl);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                if (navigator.share) void navigator.share({ title: event.name, url: event.joinUrl });
                else void navigator.clipboard.writeText(event.joinUrl);
              }}
            >
              Share
            </button>
            <a className="btn secondary" href={`/api/events/${event.id}/qr`}>
              Download QR
            </a>
            <Link className="btn secondary" href={`/host/events/${event.id}/poster`}>
              Print poster
            </Link>
          </div>
        </div>
        <div className="stack">
          {event.qrDataUrl ? <img className="qr" src={event.qrDataUrl} alt={`QR code for ${event.joinUrl}`} /> : <div className="qr stripes" />}
          <Link className="btn" href={`/host/events/${event.id}`}>
            Open dashboard
          </Link>
        </div>
      </div>
    </HostFrame>
  );
}
