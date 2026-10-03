# EventDrop

One event. Everyone's photos. One place.

Hosts create an event and share a QR code, a short join code, and a link. Guests join with no account, add photos and videos, and (when the host allows it) browse the shared gallery.

```
eventdrop.app/e/ABC123
```

## Stack

- `host/` — Next.js (App Router) web app and API. QR links open this app. Attendees do not install anything.
- `mobile/` — Flutter app for the same guest journey and host create / share / dashboard. It talks only to the host API.
- PostgreSQL, MinIO (S3-compatible). Direct uploads: the API signs a PUT, the client sends bytes to object storage, then confirms.

## Run it

```bash
cp .env.example host/.env
docker compose up --build
```

Open http://localhost:3000.

| | |
| --- | --- |
| Demo host | `host@eventdrop.app` / `demo-host-1234` |
| App owner | `admin@eventdrop.app` / `demo-admin-1234` |

MinIO console: http://localhost:9001 (`eventdrop` / `eventdrop-secret`).

`docker compose up` starts the app, Postgres, and MinIO. The app migrates and seeds on boot. Redis is not used.

MinIO’s Docker Hub image is gone, so Compose builds `eventdrop-minio` from the official `RELEASE.2025-09-07` binary on GitHub. It is still MinIO. That build rejects bucket CORS calls, so Compose sets `MINIO_API_CORS_ALLOW_ORIGIN=*` and browsers can PUT straight to MinIO.

### Local web dev

```bash
docker compose up postgres minio
cp .env.example host/.env
cd host && npm install && npm run dev
```

## Guest flow

1. Host creates an event (name, date, description, cover, privacy, gallery visibility, size limit, videos).
2. Guests open `/e/{CODE}` from the QR, the link, or the code screen.
3. Optional display name, then **Add Photos**.
4. Files go straight to MinIO. The gallery updates from the API (polling), including a live toast when someone else uploads.

20 or more selected files stop on a review step. Phones get **Shoot & drop** as a secondary action. If the network drops, the browser keeps a local queue (IndexedDB) and resumes. A file is not “done” until the server confirms it. The production build also registers a service worker for the app shell.

## Host flow

Dashboard, contributors, downloads (server-side ZIP jobs), settings, printable poster, and a projector live mode. Closing an event stops uploads and keeps the gallery for the retention period you set. A full quota refuses new uploads and does not delete anything.

System admin (`/admin`) is separate from the host dashboard.

## Storage

`StorageProvider` is the seam. MinIO is the working default (signed PUT and GET).

Amazon S3, Cloudflare R2, and local disk use the same interface and are listed in settings, but they are not configured in this build.

Google Drive and Dropbox are host-only OAuth seams. They are **not connected** — there are no client credentials, and the app will not pretend an upload reached them. Attendees never sign in to Drive or Dropbox. The intended layout, once a host connects an account, is:

```
EventDrop/{Event Name}/Photos/{filename}
EventDrop/{Event Name}/Videos/{filename}
```

## Privacy

Events are not searchable. Join codes are 6 random characters (not sequential). Wrong codes are rate-limited. Private media is served with signed URLs. Guests can be limited to their own uploads, and names can be hidden. Executables and non-image/video types are rejected. The same SHA-256 bytes are stored once per event; extra contributors are credited and visible to the host.

## Tests

With Postgres and MinIO running:

```bash
cd host && npm test
```

The acceptance test creates “Sarah & John's Wedding”, joins three guests, uploads 50 generated images, and downloads a ZIP. It does not commit binary photos.

```bash
cd mobile && flutter analyze && flutter test
```

No emulator was required for those checks. See the pull request for what was actually run.

## API

See [host/docs/api.md](host/docs/api.md).

## Limits

- Drive and Dropbox OAuth are stubs.
- S3, R2, and local disk are not wired up beyond the provider list.
- ZIP jobs run in the app process (no separate worker).
- Video duration and a poster frame are filled when `ffprobe` / `ffmpeg` are installed (they are in the app image).
- Offline resume is implemented in the web app. The Flutter app uploads while it has a connection.
