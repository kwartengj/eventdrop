"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createUploader, type UploadItem } from "@/client/uploader";
import { GuestFrame } from "@/components/chrome";
import { api } from "@/lib/api";
import type { PublicEvent } from "@/lib/types";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(item: UploadItem) {
  if (item.status === "waiting") return "Paused";
  if (item.status === "done") return "Uploaded";
  if (item.status === "duplicate") return "Already in";
  if (item.status === "error") return item.error || "Failed";
  if (item.status === "uploading") return `${Math.round(item.progress * 100)}%`;
  return "Queued";
}

function statusColor(item: UploadItem) {
  if (item.status === "done" || item.status === "duplicate") return "var(--ok)";
  if (item.status === "waiting" || item.status === "error") return "var(--warn)";
  if (item.status === "uploading") return "var(--accent)";
  return "var(--mute)";
}

export default function UploadPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [name, setName] = useState("");
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const uploader = useRef<ReturnType<typeof createUploader> | null>(null);

  useEffect(() => {
    api<{ event: PublicEvent; joined: boolean; displayName: string | null }>(`/api/join/${params.code}`, {}, "guest").then((data) => {
      if (!data.joined) {
        router.replace(`/e/${params.code}`);
        return;
      }
      setEvent(data.event);
      if (data.displayName && data.displayName !== "Guest") setName(data.displayName);
    });
  }, [params.code, router]);

  useEffect(() => {
    if (!event) return;
    api<{ items: { id: string }[] }>(`/api/events/${event.id}/media`, {}, "guest")
      .then((data) => setCount(data.items.length))
      .catch(() => undefined);
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
  const active = items.filter((item) => item.status !== "review");
  const picked = items.filter((item) => item.status === "review");
  const done = active.filter((item) => item.status === "done" || item.status === "duplicate").length;
  const allDone = active.length > 0 && active.every((item) => ["done", "duplicate", "error"].includes(item.status));
  const waitingCount = active.filter((item) => item.status === "waiting").length;

  function take(files: File[]) {
    if (files.length) uploader.current?.addFiles(files);
  }

  return (
    <GuestFrame>
      <div className="guest-head">
        <div className="row">
          <div className={event?.coverUrl ? "thumb" : "thumb stripes"}>{event?.coverUrl ? <img src={event.coverUrl} alt="" /> : null}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{event?.name || "Upload"}</div>
            <div className="fine">{name ? `Hi ${name}` : "Add your photos"}</div>
          </div>
          <span className="live-dot">
            <i />
            Live
          </span>
        </div>
        <div className="tabs">
          <span className="on">Add</span>
          <Link href={`/e/${params.code}/gallery`}>Gallery · {count}</Link>
        </div>
      </div>

      {waiting ? (
        <div className="banner">
          <span className="pulse" style={{ background: "var(--warn)", width: 9, height: 9 }} />
          <div>
            <b>Waiting for connection</b>
            <div className="fine">
              {waitingCount} saved on this phone and will resume automatically.
            </div>
          </div>
        </div>
      ) : null}

      {reviewing ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="row" style={{ padding: "16px 20px 12px" }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em" }}>{picked.length} selected</span>
            <button className="textbtn" type="button" style={{ color: "var(--accent-text)" }} onClick={() => picked.forEach((item) => uploader.current?.remove(item.id))}>
              Clear
            </button>
          </div>
          <div className="reviewgrid" style={{ padding: "0 20px 16px", overflow: "auto" }}>
            {picked.map((item) => (
              <div className="cell" key={item.id}>
                {item.previewUrl && item.type.startsWith("video/") ? <video src={item.previewUrl} muted /> : item.previewUrl ? <img src={item.previewUrl} alt="" /> : <div className="stripes" style={{ height: "100%" }} />}
                {item.type.startsWith("video/") ? <span className="vid">▶ video</span> : null}
                <button className="x" type="button" onClick={() => uploader.current?.remove(item.id)} aria-label={`Remove ${item.name}`}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="dock stack" style={{ borderTop: "1px solid var(--line)" }}>
            <button className="btn block" type="button" style={{ fontSize: 18, padding: 19 }} onClick={() => uploader.current?.confirmReview()}>
              Upload all {picked.length}
            </button>
            <label className="textbtn pick" style={{ textAlign: "center", padding: 6 }}>
              Add more
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  take([...(event.target.files || [])]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <div
          style={{ flex: 1, overflow: "auto", padding: "18px 20px 30px", display: "flex", flexDirection: "column", gap: 12 }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            take([...(event.dataTransfer.files || [])]);
          }}
        >
          <label className="add-hero pick">
            <span className="plus">+</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em" }}>Add photos & videos</span>
            <span style={{ fontSize: 15, opacity: 0.88 }}>Pick as many as you like</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => {
                take([...(event.target.files || [])]);
                event.target.value = "";
              }}
            />
          </label>
          <div className="pair">
            <label className="btn secondary pick">
              Take a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  take([...(event.target.files || [])]);
                  event.target.value = "";
                }}
              />
            </label>
            <label className="btn secondary pick">
              Record video
              <input
                type="file"
                accept="video/*"
                capture="environment"
                onChange={(event) => {
                  take([...(event.target.files || [])]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {active.length ? (
            <>
              <div>
                <div style={{ fontWeight: 700, fontSize: 19, color: allDone ? "var(--ok)" : waiting ? "var(--warn)" : "var(--ink)" }}>
                  {allDone ? `All ${done} uploaded` : waiting ? "Waiting for connection" : `Sending ${done} of ${active.length}`}
                </div>
                <div className="fine">{allDone ? "They’re in the event gallery now." : "You can keep browsing. Uploads carry on in the background."}</div>
              </div>
              {active.map((item) => (
                <div className="file" key={item.id}>
                  <div className={item.previewUrl ? "thumb" : "thumb stripes"}>
                    {item.previewUrl && item.type.startsWith("video/") ? <video src={item.previewUrl} muted /> : item.previewUrl ? <img src={item.previewUrl} alt="" /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ fontSize: 14 }}>
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</strong>
                      <span style={{ color: statusColor(item), fontWeight: 600, fontSize: 13 }}>{statusLabel(item)}</span>
                    </div>
                    <div className="bar" style={{ margin: "7px 0" }}>
                      <span style={{ width: `${Math.round(item.progress * 100)}%`, background: statusColor(item) }} />
                    </div>
                    <span className="fine">{formatBytes(item.size)}</span>
                  </div>
                </div>
              ))}
              {allDone ? (
                <Link className="btn secondary block" href={`/e/${params.code}/gallery`}>
                  See them in the gallery →
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </GuestFrame>
  );
}
