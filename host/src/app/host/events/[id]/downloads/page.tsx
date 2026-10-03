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

  return (
    <HostFrame>
      <p className="eyebrow">Export</p>
      <h1 style={{ fontSize: 42 }}>Downloads</h1>
      <p className="lede">Server-side ZIP. Large sets stay in a job until the archive is ready.</p>
      <div className="stats" style={{ marginTop: 16 }}>
        <button className="btn" type="button" onClick={() => start("photos")}>
          Download All Photos
        </button>
        <button className="btn secondary" type="button" onClick={() => start("videos")}>
          Download All Videos
        </button>
        <button className="btn secondary" type="button" onClick={() => start("all")}>
          Download Everything
        </button>
      </div>
      {error ? <p className="bad">{error}</p> : null}
      <div className="stack" style={{ marginTop: 22 }}>
        {jobs.map((job) => (
          <div key={job.id} className="card row">
            <div>
              <strong>{job.scope}</strong>
              <div className="fine">
                {job.status}
                {job.fileCount != null ? ` · ${job.fileCount} files` : ""}
                {job.error ? ` · ${job.error}` : ""}
              </div>
            </div>
            {job.status === "ready" && job.downloadUrl ? (
              <a className="btn small" href={job.downloadUrl}>
                Download ZIP
              </a>
            ) : (
              <span className="fine">{job.status === "failed" ? "Failed" : "Preparing…"}</span>
            )}
          </div>
        ))}
      </div>
    </HostFrame>
  );
}
