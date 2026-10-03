export type PublicEvent = {
  id: string;
  name: string;
  description: string | null;
  eventDate: string | null;
  hostName: string | null;
  joinCode: string;
  privacy: string;
  status: string;
  coverUrl: string | null;
  uploadsOpen: boolean;
  videosAllowed: boolean;
  galleryVisibility: string;
  showContributorNames: boolean;
  galleryVisibleUntil: string | null;
};

export type HostEvent = {
  id: string;
  name: string;
  description: string | null;
  eventDate: string | null;
  hostName: string | null;
  joinCode: string;
  joinUrl: string;
  privacy: string;
  status: string;
  coverUrl: string | null;
  qrDataUrl?: string;
  counts: { photos: number; videos: number; contributors: number };
  quota: { usedBytes: number; quotaBytes: number; label: string };
  settings: {
    galleryVisibility: string;
    showContributorNames: boolean;
    uploadsEnabled: boolean;
    videosAllowed: boolean;
    maxUploadBytes: number;
    quotaBytes: number;
    galleryRetentionDays: number;
    liveModeEnabled: boolean;
    storageDestination: string;
    activeStorage: "minio";
  };
  galleryVisibleUntil: string | null;
};

export type MediaItem = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
  uploadedAt: string | null;
  contributor: { id: string; name: string } | null;
  mine: boolean;
  canDelete: boolean;
  thumbUrl: string;
  url: string;
  downloadUrl: string;
  credits?: { id: string; name: string }[];
};

export type Contributor = { id: string; name: string; role: string; photos: number; videos: number };
