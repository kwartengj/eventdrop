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
  return (
    <HostFrame>
      <p className="eyebrow">People</p>
      <h1 style={{ fontSize: 42 }}>Contributors</h1>
      <div className="stack" style={{ marginTop: 18, maxWidth: 640 }}>
        {people.length === 0 ? <p className="muted">No one has added photos yet.</p> : null}
        {people.map((person) => (
          <div key={person.id} className="card row">
            <div>
              <strong>{person.name}</strong>
              <div className="fine">{person.role}</div>
            </div>
            <div>
              {person.photos} photos{person.videos ? ` · ${person.videos} videos` : ""}
            </div>
          </div>
        ))}
      </div>
    </HostFrame>
  );
}
