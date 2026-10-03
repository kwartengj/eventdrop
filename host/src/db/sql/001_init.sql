CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('host', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE storage_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  description text,
  event_date date,
  host_display_name text,
  join_code text NOT NULL UNIQUE,
  cover_storage_key text,
  privacy text NOT NULL DEFAULT 'link' CHECK (privacy IN ('link', 'private')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  storage_provider_id uuid REFERENCES storage_providers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  gallery_visible_until timestamptz
);

CREATE INDEX events_host_id_idx ON events(host_id);

CREATE TABLE event_settings (
  event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  gallery_visibility text NOT NULL DEFAULT 'shared' CHECK (gallery_visibility IN ('shared', 'own_only', 'host_only')),
  show_contributor_names boolean NOT NULL DEFAULT true,
  uploads_enabled boolean NOT NULL DEFAULT true,
  videos_allowed boolean NOT NULL DEFAULT true,
  max_upload_bytes bigint NOT NULL DEFAULT 52428800,
  quota_bytes bigint NOT NULL DEFAULT 10737418240,
  gallery_retention_days integer NOT NULL DEFAULT 30,
  live_mode_enabled boolean NOT NULL DEFAULT false,
  storage_destination text NOT NULL DEFAULT 'minio'
);

CREATE TABLE attendee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attendee_sessions_event_idx ON attendee_sessions(event_id);

CREATE TABLE event_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  attendee_session_id uuid REFERENCES attendee_sessions(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('host', 'attendee')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_members_actor_chk CHECK (
    (user_id IS NOT NULL AND attendee_session_id IS NULL)
    OR (user_id IS NULL AND attendee_session_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX event_members_user_idx ON event_members(event_id, user_id);
CREATE UNIQUE INDEX event_members_attendee_idx ON event_members(event_id, attendee_session_id);
CREATE INDEX event_members_event_idx ON event_members(event_id);

CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES event_members(id),
  storage_key text NOT NULL,
  thumb_key text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  width integer,
  height integer,
  duration double precision,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
  deleted_at timestamptz
);

CREATE INDEX media_event_idx ON media(event_id, status, uploaded_at DESC);
CREATE UNIQUE INDEX media_event_hash_ready_idx ON media(event_id, hash) WHERE status = 'ready';

CREATE TABLE media_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES event_members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, contributor_id)
);

CREATE INDEX media_credits_contributor_idx ON media_credits(contributor_id);

CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES event_members(id),
  media_id uuid REFERENCES media(id),
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  file_hash text,
  storage_key text,
  status text NOT NULL CHECK (status IN ('presigned', 'complete', 'failed', 'duplicate')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX uploads_event_idx ON uploads(event_id, created_at DESC);
CREATE INDEX uploads_contributor_idx ON uploads(contributor_id, created_at DESC);

CREATE TABLE download_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id),
  scope text NOT NULL CHECK (scope IN ('photos', 'videos', 'all')),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  storage_key text,
  file_count integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX download_jobs_event_idx ON download_jobs(event_id, created_at DESC);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  attendee_session_id uuid REFERENCES attendee_sessions(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_actor_chk CHECK (
    (user_id IS NOT NULL AND attendee_session_id IS NULL)
    OR (user_id IS NULL AND attendee_session_id IS NOT NULL)
  )
);

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_attendee_idx ON sessions(attendee_session_id);

CREATE TABLE join_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX join_attempts_ip_idx ON join_attempts(ip, created_at DESC);
