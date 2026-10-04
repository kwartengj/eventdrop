"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api } from "@/lib/api";

type Job = {
  id: string;
  scope: string;
  status: string;
  fileCount: number | null;
  error: string | null;
  downloadUrl: string | null;
};

export default function DownloadsPage() {
  const params = useParams<{ id: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    const data = await api<{ jobs: Job[] }>(`/api/events/${params.id}/downloads`);
    setJobs(data.jobs);
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [params.id]);

  async function start(scope: "photos" | "videos" | "all") {
    setError("");
    try {
      await api(`/api/events/${params.id}/download`, { method: "POST", body: JSON.stringify({ scope }) });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the download");
    }
  }

  const cards = [
    ["photos", "All photos", "Every photo in one ZIP"],
    ["videos", "All videos", "Every video in one ZIP"],
    ["all", "Everything", "Photos and videos together"],
  ] as const;

  return (
    <HostFrame>
      <div className="stack" style={{ gap: 22, maxWidth: 900 }}>
        <div>
          <h1>Download</h1>
          <p className="lede" style={{ marginTop: 8 }}>
            Archives are packed on the server. Large ones run in the background until they are ready.
          </p>
        </div>
        <div className="stats thirds">
          {cards.map(([scope, title, meta]) => (
            <div key={scope} className="card stack" style={{ gap: 16 }}>
              <div>
                <b style={{ fontSize: 18 }}>{title}</b>
                <div className="fine">{meta}</div>
              </div>
              <button className="btn" type="button" onClick={() => start(scope)}>
                Prepare ZIP
              </button>
            </div>
          ))}
        </div>
        {error ? <p className="bad">{error}</p> : null}
        <div className="card" style={{ padding: "8px 20px" }}>
          <div style={{ padding: "12px 0", fontWeight: 700 }}>Archives</div>
          {jobs.length === 0 ? <p className="fine">No archives yet.</p> : null}
          {jobs.map((job) => {
            const ready = job.status === "ready";
            const color = job.status === "failed" ? "var(--danger)" : ready ? "var(--ok)" : "var(--accent)";
            return (
              <div key={job.id} className="row" style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ flex: 1 }}>
                  <div className="row">
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                      {job.scope}
                      {job.fileCount != null ? ` · ${job.fileCount} files` : ""}
                    </span>
                    <span style={{ color, fontWeight: 600, fontSize: 13 }}>{job.error || job.status}</span>
                  </div>
                  <div className="bar" style={{ marginTop: 8 }}>
                    <span style={{ width: ready ? "100%" : "40%", background: color }} />
                  </div>
                </div>
                {ready && job.downloadUrl ? (
                  <a className="btn secondary small" href={job.downloadUrl}>
                    Save ZIP
                  </a>
                ) : (
                  <span className="btn secondary small" style={{ opacity: 0.45 }}>
                    Save ZIP
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </HostFrame>
  );
}
