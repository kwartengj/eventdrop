"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api, ApiError } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export default function CreateEventPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    eventDate: "",
    description: "",
    hostName: "",
    privacy: "link",
    galleryVisibility: "shared",
    maxUploadMb: 50,
    videosAllowed: true,
    quotaGb: 10,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <HostFrame plain>
      <div className="sheet">
      <div className="row" style={{ marginBottom: 8 }}>
        <a className="brand" href="/host">
          <span className="dot" />
          EventDrop
        </a>
        <a className="textbtn" href="/host">
          Cancel
        </a>
      </div>
      <h1>Create an event</h1>
      <form
        className="stack"
        style={{ maxWidth: 640, marginTop: 18 }}
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            const created = await api<{ event: HostEvent }>("/api/events", {
              method: "POST",
              body: JSON.stringify({
                ...form,
                eventDate: form.eventDate || null,
                hostName: form.hostName || null,
                description: form.description || null,
                galleryVisibility: form.privacy === "private" ? "own_only" : form.galleryVisibility,
              }),
            });
            if (cover) {
              const presign = await api<{ url: string; headers: Record<string, string>; storageKey: string }>(
                `/api/events/${created.event.id}/cover/presign`,
                {
                  method: "POST",
                  body: JSON.stringify({ fileName: cover.name, mimeType: cover.type, fileSize: cover.size }),
                },
              );
              await fetch(presign.url, { method: "PUT", headers: presign.headers, body: cover });
              await api(`/api/events/${created.event.id}/cover/complete`, {
                method: "POST",
                body: JSON.stringify({ storageKey: presign.storageKey }),
              });
            }
            router.push(`/host/events/${created.event.id}/share`);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not create the event");
          }
        }}
      >
        <label>
          Event name
          <input value={form.name} onChange={(event) => set("name", event.target.value)} required placeholder="Sarah & John's Wedding" />
        </label>
        <label>
          Date
          <input type="date" value={form.eventDate} onChange={(event) => set("eventDate", event.target.value)} />
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={(event) => set("description", event.target.value)} />
        </label>
        <label>
          Your name
          <input value={form.hostName} onChange={(event) => set("hostName", event.target.value)} placeholder="Shown to guests" />
        </label>
        <label>
          Cover photo
          <input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] || null)} />
        </label>
        <label>
          Privacy
          <select
            value={form.privacy}
            onChange={(event) => {
              const privacy = event.target.value;
              setForm((current) => ({
                ...current,
                privacy,
                galleryVisibility: privacy === "private" ? "own_only" : current.galleryVisibility,
              }));
            }}
          >
            <option value="link">Anyone with the code</option>
            <option value="private">Private — guests only see their own photos</option>
          </select>
        </label>
        <label>
          Gallery visibility
          <select value={form.galleryVisibility} onChange={(event) => set("galleryVisibility", event.target.value)}>
            <option value="shared">Shared gallery</option>
            <option value="own_only">Hide other people&apos;s photos</option>
            <option value="host_only">Host only</option>
          </select>
        </label>
        <label>
          Max upload size (MB)
          <input type="number" min={1} max={200} value={form.maxUploadMb} onChange={(event) => set("maxUploadMb", Number(event.target.value))} />
        </label>
        <label>
          Storage quota (GB)
          <input type="number" min={1} max={200} value={form.quotaGb} onChange={(event) => set("quotaGb", Number(event.target.value))} />
        </label>
        <label className="row" style={{ justifyContent: "flex-start" }}>
          <input type="checkbox" checked={form.videosAllowed} onChange={(event) => set("videosAllowed", event.target.checked)} />
          Allow videos
        </label>
        {error ? <p className="bad">{error}</p> : null}
        <button className="btn" type="submit">
          Create event
        </button>
      </form>
      </div>
    </HostFrame>
  );
}
