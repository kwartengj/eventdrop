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
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    api<{ event: PublicEvent; joined: boolean; displayName: string | null }>(`/api/join/${code}`, {}, "guest")
      .then((data) => {
        setEvent(data.event);
        setJoined(data.joined);
        if (data.displayName && data.displayName !== "Guest") setName(data.displayName);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not open this event"));
  }, [code]);

  async function enter(next: "upload" | "gallery") {
    setError("");
    try {
      await api(`/api/join/${code}`, { method: "POST", body: JSON.stringify({ displayName: name }) }, "guest");
      router.push(next === "upload" ? `/e/${code}/upload` : `/e/${code}/gallery`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join");
    }
  }

  return (
    <GuestFrame>
      {!event && !error ? <p className="muted">Finding the event…</p> : null}
      {error && !event ? <p className="bad">{error}</p> : null}
      {event ? (
        <>
          <div className={event.coverUrl ? "cover" : "cover stripes"}>
            {event.coverUrl ? <img src={event.coverUrl} alt="" /> : event.name.slice(0, 1)}
          </div>
          <div className="stack">
            <p className="eyebrow">{event.privacy === "private" ? "Private event" : "You're invited"}</p>
            <h1 style={{ fontSize: 40 }}>{event.name}</h1>
            <p className="lede">
              {[prettyDate(event.eventDate), event.hostName ? `Hosted by ${event.hostName}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {event.description ? <p className="muted">{event.description}</p> : null}
          </div>
          {!joined ? (
            <label>
              Your name <span className="fine">(optional)</span>
              <input value={name} placeholder="Alex" onChange={(e) => setName(e.target.value)} />
            </label>
          ) : (
            <p className="fine">You&apos;re in{name ? ` as ${name}` : ""}.</p>
          )}
          {error ? <p className="bad">{error}</p> : null}
          <button className="btn block" type="button" disabled={!event.uploadsOpen} onClick={() => enter("upload")}>
            Add Photos
          </button>
          {!event.uploadsOpen ? <p className="fine">Uploads are closed for this event.</p> : null}
          <button className="btn secondary block" type="button" onClick={() => enter("gallery")}>
            Browse gallery
          </button>
        </>
      ) : null}
    </GuestFrame>
  );
}
