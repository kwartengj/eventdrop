"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HostFrame } from "@/components/chrome";
import { api } from "@/lib/api";
import type { Contributor } from "@/lib/types";

export default function ContributorsPage() {
  const params = useParams<{ id: string }>();
  const [people, setPeople] = useState<Contributor[]>([]);
  useEffect(() => {
    api<{ contributors: Contributor[] }>(`/api/events/${params.id}/contributors`).then((data) => setPeople(data.contributors));
  }, [params.id]);
  const max = Math.max(1, ...people.map((person) => person.photos + person.videos));
  return (
    <HostFrame>
      <div className="stack" style={{ gap: 20, maxWidth: 860 }}>
        <div>
          <h1 style={{ fontSize: 34 }}>Contributors</h1>
          <p className="lede" style={{ marginTop: 8 }}>
            {people.length} {people.length === 1 ? "person has" : "people have"} added photos.
          </p>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 2fr 80px 80px", gap: 16, padding: "12px 20px", fontSize: 12, fontWeight: 600, color: "var(--mute)", borderBottom: "1px solid var(--line)" }}>
            <span>Name</span>
            <span>Share of uploads</span>
            <span>Photos</span>
            <span>Videos</span>
          </div>
          {people.length === 0 ? <p className="fine" style={{ padding: 20 }}>No one has added photos yet.</p> : null}
          {people.map((person) => (
            <div key={person.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 2fr 80px 80px", gap: 16, padding: "12px 20px", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                <span className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                  {person.name.slice(0, 1)}
                </span>
                {person.name}
              </span>
              <span className="sharebar">
                <span style={{ width: `${((person.photos + person.videos) / max) * 100}%` }} />
              </span>
              <span>{person.photos}</span>
              <span className="fine">{person.videos}</span>
            </div>
          ))}
        </div>
      </div>
    </HostFrame>
  );
}
