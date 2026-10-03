"use client";

import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { ago, api, ApiError } from "@/lib/api";
import { formatBytes } from "./format";

type Overview = {
  totalEvents: number;
  activeEvents: number;
  users: number;
  media: number;
  storageBytes: number;
  uploadsLast24h: number;
  failedUploads: number;
  recentFailures: { id: string; fileName: string; error: string | null; createdAt: string }[];
  health: { database: string; storage: string };
};

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Overview>("/api/admin/overview")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Admin only"));
  }, []);
  return (
    <HostFrame>
      <p className="eyebrow">App owner</p>
      <h1>System</h1>
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
