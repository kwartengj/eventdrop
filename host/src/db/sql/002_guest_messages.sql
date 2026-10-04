CREATE TABLE guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_session_id uuid NOT NULL UNIQUE REFERENCES attendee_sessions(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_messages_event_idx ON guest_messages(event_id, created_at);
