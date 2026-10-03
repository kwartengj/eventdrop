"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Viewer } from "@/components/viewer";
import { api } from "@/lib/api";
import type { MediaItem, PublicEvent } from "@/lib/types";

export default function GuestViewerPage() {
  const params = useParams<{ code: string; mediaId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    api<{ event: PublicEvent }>(`/api/join/${params.code}`, {}, "guest").then((preview) =>
      api<{ items: MediaItem[] }>(`/api/events/${preview.event.id}/media`, {}, "guest").then((data) => setItems(data.items)),
    );
  }, [params.code]);

  return (
    <Viewer
      items={items}
      mediaId={params.mediaId}
      hrefFor={(id) => `/e/${params.code}/view/${id}`}
      onClose={() => router.push(`/e/${params.code}/gallery`)}
      onDelete={async (id) => {
        await api(`/api/media/${id}`, { method: "DELETE" }, "guest");
        router.push(`/e/${params.code}/gallery`);
      }}
    />
  );
}
