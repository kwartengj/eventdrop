"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GuestFrame } from "@/components/chrome";
import { api, ApiError, prettyDate } from "@/lib/api";
import type { PublicEvent } from "@/lib/types";

export default function LandingPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ event: PublicEvent; joined: boolean; displayName: string | null }>(`/api/join/${code}`, {}, "guest")
      .then((data) => {
        setEvent(data.event);
        if (data.displayName && data.displayName !== "Guest") setName(data.displayName);
        if (data.joined) router.replace(`/e/${code}/upload`);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not open this event"));
  }, [code, router]);

  async function enter() {
    setError("");
    try {
      await api(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ displayName: name }) }, "guest");
      router.push(`/e/${code}/upload`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join");
    }
  }

  const when = event
    ? [prettyDate(event.eventDate), event.hostName ? `Hosted by ${event.hostName}` : ""].filter(Boolean).join(" · ")
    : "";

  return (
    <GuestFrame>
      {!event && !error ? <p className="muted" style={{ padding: 24 }}>Finding the event…</p> : null}
      {error && !event ? <p className="bad" style={{ padding: 24 }}>{error}</p> : null}
      {event ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div className={event.coverUrl ? "cover" : "cover stripes"}>{event.coverUrl ? <img src={event.coverUrl} alt="" /> : null}</div>
          <div className="guest-pad">
            <div className="stack" style={{ gap: 8 }}>
              <span className="mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: "var(--accent-text)", textTransform: "uppercase" }}>
                You&apos;re invited to add photos
              </span>
              <h1 style={{ fontSize: 34 }}>{event.name}</h1>
              {when ? <span style={{ fontSize: 15, color: "var(--mute)" }}>{when}</span> : null}
            </div>
            <label style={{ marginTop: 6 }}>
              <span>
                Your name <span style={{ color: "var(--mute)", fontWeight: 400 }}>(optional)</span>
              </span>
              <input value={name} placeholder="So the couple knows who shared" onChange={(e) => setName(e.target.value)} />
            </label>
            {error ? <p className="bad">{error}</p> : null}
            <button className="btn block" type="button" disabled={!event.uploadsOpen} onClick={enter} style={{ fontSize: 18, padding: 19 }}>
              Join &amp; add photos
            </button>
            {!event.uploadsOpen ? <p className="fine">Uploads are closed for this event. You can still look if the host left the gallery open.</p> : null}
            <p className="fine" style={{ textAlign: "center" }}>
              No account or app needed. Only people with this link or code can see the event.
            </p>
          </div>
        </div>
      ) : null}
    </GuestFrame>
  );
}
