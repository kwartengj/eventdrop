"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createUploader, type UploadItem } from "@/client/uploader";
import { GuestFrame } from "@/components/chrome";
import { api } from "@/lib/api";
import type { PublicEvent } from "@/lib/types";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [over, setOver] = useState(false);
  const uploader = useRef<ReturnType<typeof createUploader> | null>(null);

  useEffect(() => {
    api<{ event: PublicEvent; joined: boolean }>(`/api/join/${params.code}`, {}, "guest").then((data) => {
      if (!data.joined) {
        router.replace(`/e/${params.code}`);
        return;
      }
      setEvent(data.event);
    });
  }, [params.code, router]);

  useEffect(() => {
    if (!event) return;
    const engine = createUploader(event.id, setItems);
    uploader.current = engine;
    void engine.resume();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => engine.dispose();
  }, [event]);

  const reviewing = items.some((item) => item.status === "review");
  const waiting = items.some((item) => item.status === "waiting");
  const busy = items.some((item) => item.status === "uploading" || item.status === "queued");
  const finished = items.length > 0 && items.every((item) => ["done", "duplicate", "error"].includes(item.status));
  const added = items.filter((item) => item.status === "done" || item.status === "duplicate").length;
  const dupes = items.filter((item) => item.status === "duplicate").length;

  const title = useMemo(() => {
    if (reviewing) return "Review";
    if (finished) return "Done";
    if (busy || waiting) return "Uploading";
    return "Add photos";
  }, [reviewing, finished, busy, waiting]);

  return (
    <GuestFrame>
      <div className="row">
        <div>
          <p className="eyebrow">{event?.name || "Upload"}</p>
          <h1 style={{ fontSize: 34 }}>{title}</h1>
        </div>
        <Link className="textbtn" href={`/e/${params.code}/gallery`}>
          Gallery
        </Link>
      </div>
      {waiting ? <div className="banner">Waiting for connection. Photos stay on this phone and resume automatically.</div> : null}

      {reviewing ? (
        <div className="stack">
          <p className="lede">{items.filter((item) => item.status === "review").length} selected. Remove any you don&apos;t want.</p>
          <div className="reviewgrid">
            {items
              .filter((item) => item.status === "review")
              .map((item) => (
                <div className="cell" key={item.id}>
                  {item.previewUrl && item.type.startsWith("video/") ? (
                    <video src={item.previewUrl} muted />
                  ) : item.previewUrl ? (
                    <img src={item.previewUrl} alt="" />
                  ) : (
                    <div className="stripes" style={{ width: "100%", height: "100%" }} />
                  )}
                  <button className="x" type="button" onClick={() => uploader.current?.remove(item.id)} aria-label={`Remove ${item.name}`}>
                    ×
                  </button>
                </div>
              ))}
          </div>
          <button className="btn block" type="button" onClick={() => uploader.current?.confirmReview()}>
            Upload {items.filter((item) => item.status === "review").length}
          </button>
        </div>
      ) : null}

      {!reviewing && !finished ? (
        <div
          className="drop"
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            const files = [...event.dataTransfer.files];
            if (files.length) uploader.current?.addFiles(files);
          }}
          style={over ? { borderColor: "var(--coral)" } : undefined}
        >
          <div className="plus">+</div>
          <strong>Add Photos & Videos</strong>
          <p className="fine">Drop them here, or choose from your camera roll.</p>
          <label className="btn pick">
            Add Photos & Videos
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                if (files.length) uploader.current?.addFiles(files);
                event.target.value = "";
              }}
            />
          </label>
          <label className="btn secondary pick">
            Shoot & drop
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                if (files.length) uploader.current?.addFiles(files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}

      {items.some((item) => item.status !== "review") ? (
        <div>
          {items
            .filter((item) => item.status !== "review")
            .map((item) => (
              <div className="file" key={item.id}>
                <div className={item.previewUrl ? "thumb" : "thumb stripes"}>
                  {item.previewUrl && item.type.startsWith("video/") ? (
                    <video src={item.previewUrl} muted />
                  ) : item.previewUrl ? (
                    <img src={item.previewUrl} alt="" />
                  ) : null}
                </div>
                <div>
                  <strong>{item.name}</strong>
                  <div className="fine">
                    {formatBytes(item.size)} · {Math.round(item.progress * 100)}% ·{" "}
                    {item.status === "waiting"
                      ? "Waiting for connection"
                      : item.status === "done"
                        ? "Uploaded"
                        : item.status === "duplicate"
                          ? "Already in the event"
                          : item.status === "error"
                            ? item.error
                            : item.status === "uploading"
                              ? "Uploading"
                              : "Queued"}
                  </div>
                  <div className="bar">
                    <span style={{ width: `${Math.round(item.progress * 100)}%` }} />
                  </div>
                </div>
                <span className={item.status === "error" ? "bad" : "ok"}>
                  {item.status === "done" || item.status === "duplicate" ? "✓" : item.status === "error" ? "!" : ""}
                </span>
              </div>
            ))}
        </div>
      ) : null}

      {finished ? (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>That&apos;s in.</h2>
          <p className="lede">
            {added} added{dupes ? ` · ${dupes} already in the album` : ""}.
          </p>
          <Link className="btn" href={`/e/${params.code}/gallery`}>
            View gallery
          </Link>
          <label className="btn secondary pick">
            Add more
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                if (files.length) uploader.current?.addFiles(files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      ) : null}
    </GuestFrame>
  );
}
