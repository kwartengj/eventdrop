"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { ago, api } from "@/lib/api";

type Note = { id: string; name: string; message: string; createdAt: string };
type Payload = {
  event: { name: string; eventDate: string | null; hostName: string | null };
  messages: Note[];
};

export default function MessagesPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Payload>(`/api/events/${params.id}/messages`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load messages"));
  }, [params.id]);

  const count = data?.messages.length ?? 0;
  const pdf = `/api/events/${params.id}/messages/export?format=pdf`;
  const xlsx = `/api/events/${params.id}/messages/export?format=xlsx`;

  return (
    <HostFrame>
      <div className="stack" style={{ gap: 22, maxWidth: 980 }}>
        <div className="page-head">
          <div>
            <h1 style={{ fontSize: 34 }}>Messages</h1>
            <p className="lede" style={{ marginTop: 8 }}>
              {data
                ? count === 0
                  ? "Notes guests leave when they join will gather here."
                  : `${count} ${count === 1 ? "note" : "notes"} ready for a framed guestbook.`
                : "Loading the guestbook…"}
            </p>
          </div>
          <div className="export-row">
            <a className="btn" href={pdf}>
              Wall print PDF
            </a>
            <a className="btn secondary" href={xlsx}>
              Export Excel
            </a>
          </div>
        </div>
        {error ? <p className="bad">{error}</p> : null}
        {data && count === 0 ? (
          <div className="card">
            <p className="fine" style={{ margin: 0 }}>
              No messages yet. Guests can leave one with their name when they join.
            </p>
          </div>
        ) : null}
        <div className="guestbook">
          {data?.messages.map((note) => (
            <article key={note.id} className="note">
              <p>“{note.message}”</p>
              <footer>
                <b style={{ letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 12 }}>{note.name}</b>
                <span className="fine">{ago(note.createdAt)}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </HostFrame>
  );
}
