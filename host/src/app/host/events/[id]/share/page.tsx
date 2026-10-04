"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame, Logo } from "@/components/chrome";
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
      <HostFrame plain>
        <p className="muted" style={{ padding: 24 }}>
          Loading…
        </p>
      </HostFrame>
    );
  }

  const path = event.joinUrl.replace(/^https?:\/\//, "");

  return (
    <HostFrame plain>
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 28 }}>
        <Logo href="/host" />
        <div style={{ textAlign: "center" }}>
          <span className="live-dot" style={{ justifyContent: "center" }}>
            <i style={{ animation: "none" }} />
            Your event is ready
          </span>
          <h1 style={{ fontSize: 44, marginTop: 10 }}>{event.name}</h1>
        </div>
        <div className="created">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, borderRight: "1px solid var(--line)" }}>
            {event.qrDataUrl ? <img className="qr" src={event.qrDataUrl} alt={`QR code for ${event.joinUrl}`} /> : <div className="qr stripes" />}
            <b>Scan to share your photos</b>
          </div>
          <div>
            <div className="fine">Join code</div>
            <p className="sharecode">{event.joinCode}</p>
            <div className="share-url">
              <span className="mono">{path}</span>
              <button
                className="btn small"
                type="button"
                style={{ background: "var(--ink)", color: "var(--bg)" }}
                onClick={async () => {
                  await navigator.clipboard.writeText(event.joinUrl);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="pair" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <button
                className="btn secondary small"
                type="button"
                onClick={() => {
                  if (navigator.share) void navigator.share({ title: event.name, url: event.joinUrl });
                  else void navigator.clipboard.writeText(event.joinUrl);
                }}
              >
                Share event
              </button>
              <a className="btn secondary small" href={`/api/events/${event.id}/qr`}>
                Download QR
              </a>
              <Link className="btn secondary small" href={`/host/events/${event.id}/poster`}>
                Print poster
              </Link>
            </div>
            <Link className="btn block" href={`/host/events/${event.id}`}>
              Open dashboard →
            </Link>
          </div>
        </div>
      </div>
    </HostFrame>
  );
}
