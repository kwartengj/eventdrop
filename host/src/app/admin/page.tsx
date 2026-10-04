"use client";

import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { ago, api, ApiError } from "@/lib/api";
import { formatBytes } from "./format";

type AdminEvent = {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  createdAt: string;
  hostName: string;
  hostEmail: string;
};

type Overview = {
  totalEvents: number;
  activeEvents: number;
  users: number;
  media: number;
  storageBytes: number;
  uploadsLast24h: number;
  failedUploads: number;
  events: AdminEvent[];
  recentFailures: { id: string; fileName: string; error: string | null; createdAt: string }[];
  health: { database: string; storage: string };
};

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  function load() {
    api<Overview>("/api/admin/overview")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Admin only"));
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(event: AdminEvent) {
    if (!window.confirm(`Delete "${event.name}"? The join code stops working and every photo in it is removed. This cannot be undone.`)) {
      return;
    }
    setPending(event.id);
    setError("");
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      setData((current) =>
        current
          ? {
              ...current,
              events: current.events.filter((item) => item.id !== event.id),
              totalEvents: Math.max(0, current.totalEvents - 1),
              activeEvents: event.status === "active" ? Math.max(0, current.activeEvents - 1) : current.activeEvents,
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the event");
    } finally {
      setPending("");
    }
  }
  return (
    <HostFrame>
      <p className="eyebrow">App owner</p>
      <h1 style={{ fontSize: 42 }}>System</h1>
      {error ? <p className="bad">{error} Sign in as admin@eventdrop.app.</p> : null}
      {data ? (
        <>
          <div className="admin-grid" style={{ marginTop: 18 }}>
            {[
              ["Events", data.totalEvents],
              ["Active", data.activeEvents],
              ["Users", data.users],
              ["Media", data.media],
              ["Storage", formatBytes(data.storageBytes)],
              ["Uploads 24h", data.uploadsLast24h],
              ["Failed uploads", data.failedUploads],
              ["Health", `${data.health.database} / ${data.health.storage}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="card stat">
                <b style={{ fontSize: 26 }}>{value}</b>
                {label}
              </div>
            ))}
          </div>
          <div className="card stack" style={{ marginTop: 18 }}>
            <strong>Events</strong>
            {data.events.length === 0 ? <p className="fine">No events.</p> : null}
            {data.events.map((event) => (
              <div key={event.id} className="row">
                <div>
                  <strong>{event.name}</strong>
                  <p className="fine">
                    {event.hostName} · {event.hostEmail} · <span className="mono">{event.joinCode}</span> · {event.status} · {ago(event.createdAt)}
                  </p>
                </div>
                <button className="btn danger small" type="button" disabled={pending === event.id} onClick={() => void remove(event)}>
                  {pending === event.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
          <div className="card stack" style={{ marginTop: 18 }}>
            <strong>Failed uploads</strong>
            {data.recentFailures.length === 0 ? <p className="fine">None right now.</p> : null}
            {data.recentFailures.map((row) => (
              <div key={row.id}>
                {row.fileName} · {row.error} · {ago(row.createdAt)}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </HostFrame>
  );
}
