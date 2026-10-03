# EventDrop API

Base URL: `http://localhost:3000` in local Docker. Session auth is an httpOnly cookie (`ed_host` or `ed_guest`) or `Authorization: Bearer <token>`. Login and join return the token in JSON for the mobile app.

Guest pages send `X-EventDrop-View: guest` so a browser that is also signed in as the host still acts as the attendee.

Errors: `{ "error": "…", "code": "…" }` with 4xx/5xx.

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` | Sets `ed_host`. Returns `{ token, user }`. |
| POST | `/api/auth/logout` | | Clears the host session. |
| GET | `/api/auth/me` | | `{ user, guest }`. |
| PATCH | `/api/me/name` | `{ displayName }` | Attendee nickname. |

## Events

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/events` | Host | Events for the signed-in host. |
| POST | `/api/events` | Host | Create. Returns the event, join URL, and QR data URL. |
| GET | `/api/events/:id` | Host | Event, counts, quota, settings, QR. |
| PATCH | `/api/events/:id` | Host | Name, privacy, gallery, uploads, videos, status, quota, destination, live mode. |
| POST | `/api/events/:id/close` | Host | Stop uploads. Gallery stays until the retention date. Media is kept. |
| POST | `/api/events/:id/join` | Guest | Same as join-by-code, addressed by id. |
| POST | `/api/events/:id/leave` | Guest | Drops the attendee session. Media stays. |
| GET | `/api/events/:id/qr` | Host | PNG download. The QR encodes `{PUBLIC_APP_URL}/e/{CODE}`. |
| GET | `/api/events/:id/media` | Host or guest | `?type=photo\|video&contributorId=&date=YYYY-MM-DD`. Signed thumb, view, and download URLs. |
| DELETE | `/api/media/:id` | Host, or the uploader | Removes the object. Does not free space by deleting other people's files. |
| GET | `/api/events/:id/contributors` | Host, or a guest when names are visible | `{ name, photos, videos }`. |
| GET | `/api/events/:id/activity` | Host | Recent upload rows. |
| GET | `/api/events/:id/quota` | Host | `{ usedBytes, quotaBytes, label }`. |
| GET | `/api/events/:id/live` | Host | `{ enabled, items }` for the projector. |
| POST | `/api/events/:id/live` | Host | `{ enabled }`. |

Create body (all optional except `name`):

```json
{
  "name": "Sarah & John's Wedding",
  "eventDate": "2026-06-20",
  "description": "Garden ceremony",
  "hostName": "Sarah",
  "privacy": "link",
  "galleryVisibility": "shared",
  "maxUploadMb": 50,
  "videosAllowed": true,
  "quotaGb": 10
}
```

`privacy` is `link` or `private`. `galleryVisibility` is `shared`, `own_only`, or `host_only`. `status` on update is `active`, `closed`, or `archived`.

## Join

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/join/:code` | Public preview. Failed guesses are rate-limited (20 / 10 minutes / IP). |
| POST | `/api/join/:code` | `{ displayName? }`. Sets `ed_guest` and returns `{ token, event }`. No account. |

Codes are 6 characters from a 32-character alphabet. They are not sequential integers.

## Uploads

Bytes never pass through the app server.

1. `POST /api/uploads/presign`

```json
{ "eventId": "…", "fileName": "a.jpg", "mimeType": "image/jpeg", "fileSize": 1200, "fileHash": "<sha256 hex>" }
```

- Allowed images: jpeg, png, webp, gif, heic, heif.
- Allowed videos: mp4, quicktime, webm, and only when the event allows video.
- Executables and other types are rejected.
- Closed events, disabled uploads, oversize files, and a full quota return an error. Quota failures do not delete existing media.
- If `fileHash` already exists on a ready item, the response is `{ duplicate: true, mediaId }` and no second object is stored. The new contributor is credited.

Otherwise: `{ duplicate: false, uploadId, url, headers }`.

2. `PUT` the file to `url` with `headers` (direct to MinIO).

3. `POST /api/uploads/complete` `{ "uploadId" }`.

The server checks the object, sniffs magic bytes, hashes the bytes, writes width/height (and duration for video when ffprobe is available), stores a thumbnail, and inserts `media` with status `ready`.

Cover photos (host only): `POST /api/events/:id/cover/presign` then PUT, then `POST /api/events/:id/cover/complete` `{ storageKey }`.

## Downloads

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/events/:id/download` | `{ scope: "photos" \| "videos" \| "all" }`. Returns a job (`202`). |
| GET | `/api/events/:id/download?scope=` | Same, starts a job. |
| GET | `/api/events/:id/downloads` | Recent jobs. |
| GET | `/api/events/:id/downloads/:jobId` | `pending`, `processing`, `ready`, or `failed`. `ready` includes a signed ZIP URL. |

Single-file download uses the `downloadUrl` on each media item (signed, `Content-Disposition: attachment`).

## Storage and admin

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/storage/destinations` | MinIO is connected. S3, R2, local, Drive, and Dropbox are listed and not connected. |
| GET | `/api/admin/overview` | Admin role. Totals, storage, upload activity, failed uploads, database and storage health. |
| GET | `/api/health` | `{ ok, database, storage }`. |

Changing the destination to Drive or Dropbox does not move files. Uploads stay on MinIO until that provider is actually connected. Planned host folders: `EventDrop/{Event Name}/Photos` and `EventDrop/{Event Name}/Videos`.
