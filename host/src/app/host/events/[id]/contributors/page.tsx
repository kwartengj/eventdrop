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
          <h1>Contributors</h1>
          <p className="lede" style={{ marginTop: 8 }}>
            {people.length} {people.length === 1 ? "person has" : "people have"} added photos.
          </p>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="people head">
            <span>Name</span>
            <span className="share-col">Share of uploads</span>
            <span>Photos</span>
            <span>Videos</span>
          </div>
          {people.length === 0 ? <p className="fine" style={{ padding: 20 }}>No one has added photos yet.</p> : null}
          {people.map((person) => (
            <div className="people" key={person.id}>
              <span className="who">
                <span className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                  {person.name.slice(0, 1)}
                </span>
                <b>{person.name}</b>
              </span>
              <span className="sharebar share-col">
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
