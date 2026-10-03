"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

type Destination = { kind: string; name: string; connected: boolean; detail: string; folderLayout?: string };

export default function SettingsPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<HostEvent | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api<{ event: HostEvent }>(`/api/events/${params.id}`).then((data) => setEvent(data.event));
    api<{ destinations: Destination[] }>("/api/storage/destinations").then((data) => setDestinations(data.destinations));
  }, [params.id]);

  if (!event) {
    return (
      <HostFrame>
        <p className="muted">Loading…</p>
      </HostFrame>
    );
  }

  const selected = destinations.find((item) => item.kind === event.settings.storageDestination);

  return (
    <HostFrame>
      <div className="sheet">
      <p className="eyebrow">Event</p>
      <h1>Settings</h1>
      <form
        className="stack"
        style={{ marginTop: 16 }}
        onSubmit={async (submit) => {
          submit.preventDefault();
          const data = await api<{ event: HostEvent }>(`/api/events/${event.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: event.name,
              description: event.description,
              eventDate: event.eventDate,
              hostName: event.hostName,
              privacy: event.privacy,
              status: event.status,
              galleryVisibility: event.settings.galleryVisibility,
              showContributorNames: event.settings.showContributorNames,
              uploadsEnabled: event.settings.uploadsEnabled,
              videosAllowed: event.settings.videosAllowed,
              maxUploadMb: Math.round(event.settings.maxUploadBytes / (1024 * 1024)),
              quotaGb: Math.max(1, Math.round(event.settings.quotaBytes / (1024 * 1024 * 1024))),
              galleryRetentionDays: event.settings.galleryRetentionDays,
              liveModeEnabled: event.settings.liveModeEnabled,
              storageDestination: event.settings.storageDestination,
            }),
          });
          setEvent(data.event);
          setSaved("Saved");
        }}
      >
        <label>
          Name
          <input value={event.name} onChange={(e) => setEvent({ ...event, name: e.target.value })} />
        </label>
        <label>
          Description
          <textarea value={event.description || ""} onChange={(e) => setEvent({ ...event, description: e.target.value })} />
        </label>
        <label>
          Date
          <input type="date" value={event.eventDate || ""} onChange={(e) => setEvent({ ...event, eventDate: e.target.value || null })} />
        </label>
        <label>
          Host name
          <input value={event.hostName || ""} onChange={(e) => setEvent({ ...event, hostName: e.target.value })} />
        </label>
        <label>
          Privacy
          <select value={event.privacy} onChange={(e) => setEvent({ ...event, privacy: e.target.value })}>
            <option value="link">Anyone with the code</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label>
          Gallery visibility
          <select
            value={event.settings.galleryVisibility}
            onChange={(e) => setEvent({ ...event, settings: { ...event.settings, galleryVisibility: e.target.value } })}
          >
            <option value="shared">Shared</option>
            <option value="own_only">Hide others&apos; photos from attendees</option>
            <option value="host_only">Host only</option>
          </select>
        </label>
        <label className="row" style={{ justifyContent: "flex-start" }}>
          <input
            type="checkbox"
            checked={event.settings.showContributorNames}
            onChange={(e) => setEvent({ ...event, settings: { ...event.settings, showContributorNames: e.target.checked } })}
          />
          Show contributor names
        </label>
        <label className="row" style={{ justifyContent: "flex-start" }}>
          <input
            type="checkbox"
            checked={event.settings.uploadsEnabled}
            onChange={(e) => setEvent({ ...event, settings: { ...event.settings, uploadsEnabled: e.target.checked } })}
          />
          Uploads allowed
        </label>
        <label className="row" style={{ justifyContent: "flex-start" }}>
          <input
            type="checkbox"
            checked={event.settings.videosAllowed}
            onChange={(e) => setEvent({ ...event, settings: { ...event.settings, videosAllowed: e.target.checked } })}
          />
          Videos allowed
        </label>
        <label>
          Event status
          <select value={event.status} onChange={(e) => setEvent({ ...event, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="closed">Closed — stop uploads, keep the gallery</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          Gallery stays open after close (days)
          <input
            type="number"
            min={1}
            value={event.settings.galleryRetentionDays}
            onChange={(e) =>
              setEvent({ ...event, settings: { ...event.settings, galleryRetentionDays: Number(e.target.value) } })
            }
          />
        </label>
        <label>
          Max upload (MB)
          <input
            type="number"
            min={1}
            value={Math.round(event.settings.maxUploadBytes / (1024 * 1024))}
            onChange={(e) =>
              setEvent({ ...event, settings: { ...event.settings, maxUploadBytes: Number(e.target.value) * 1024 * 1024 } })
            }
          />
        </label>
        <label>
          Quota (GB)
          <input
            type="number"
            min={1}
            value={Math.max(1, Math.round(event.settings.quotaBytes / (1024 * 1024 * 1024)))}
            onChange={(e) =>
              setEvent({
                ...event,
                settings: { ...event.settings, quotaBytes: Number(e.target.value) * 1024 * 1024 * 1024 },
              })
            }
          />
        </label>
        <p className="fine">Using {event.quota.label}. A full quota stops new uploads. Nothing already stored is deleted.</p>
        <label>
          Storage destination
          <select
            value={event.settings.storageDestination}
            onChange={(e) => setEvent({ ...event, settings: { ...event.settings, storageDestination: e.target.value } })}
          >
            {destinations.map((destination) => (
              <option key={destination.kind} value={destination.kind}>
                {destination.name}
                {destination.connected ? "" : " — not connected"}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <p className="fine">
            {selected.detail}
            {selected.folderLayout ? ` Folder layout: ${selected.folderLayout}.` : ""}
            {selected.kind !== "minio"
              ? " Uploads continue on MinIO until this destination is connected. Attendees never sign in to Drive or Dropbox."
              : ""}
          </p>
        ) : null}
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button className="btn" type="submit">
            Save settings
          </button>
          {saved ? <span className="ok">{saved}</span> : null}
        </div>
      </form>
      </div>
    </HostFrame>
  );
}
