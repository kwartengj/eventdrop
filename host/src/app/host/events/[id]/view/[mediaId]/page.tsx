"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Viewer } from "@/components/viewer";
import { api } from "@/lib/api";
import type { MediaItem } from "@/lib/types";

export default function HostViewerPage() {
  const params = useParams<{ id: string; mediaId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);
  useEffect(() => {
    api<{ items: MediaItem[] }>(`/api/events/${params.id}/media`).then((data) => setItems(data.items));
  }, [params.id]);
  return (
    <Viewer
      items={items}
      mediaId={params.mediaId}
      hrefFor={(id) => `/host/events/${params.id}/view/${id}`}
      onClose={() => router.push(`/host/events/${params.id}`)}
      onDelete={async (id) => {
        await api(`/api/media/${id}`, { method: "DELETE" });
        router.push(`/host/events/${params.id}`);
      }}
    />
  );
}
