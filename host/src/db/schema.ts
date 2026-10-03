import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storageProviders = pgTable("storage_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").notNull().default({}),
  enabled: boolean("enabled").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    eventDate: date("event_date"),
    hostDisplayName: text("host_display_name"),
    joinCode: text("join_code").notNull().unique(),
    coverStorageKey: text("cover_storage_key"),
    privacy: text("privacy").notNull().default("link"),
    status: text("status").notNull().default("active"),
    storageProviderId: uuid("storage_provider_id").references(() => storageProviders.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    galleryVisibleUntil: timestamp("gallery_visible_until", { withTimezone: true }),
  },
  (t) => [index("events_host_id_idx").on(t.hostId)],
);

export const eventSettings = pgTable("event_settings", {
  eventId: uuid("event_id")
    .primaryKey()
    .references(() => events.id, { onDelete: "cascade" }),
  galleryVisibility: text("gallery_visibility").notNull().default("shared"),
  showContributorNames: boolean("show_contributor_names").notNull().default(true),
  uploadsEnabled: boolean("uploads_enabled").notNull().default(true),
  videosAllowed: boolean("videos_allowed").notNull().default(true),
  maxUploadBytes: bigint("max_upload_bytes", { mode: "number" }).notNull().default(52_428_800),
  quotaBytes: bigint("quota_bytes", { mode: "number" }).notNull().default(10_737_418_240),
  galleryRetentionDays: integer("gallery_retention_days").notNull().default(30),
  liveModeEnabled: boolean("live_mode_enabled").notNull().default(false),
  storageDestination: text("storage_destination").notNull().default("minio"),
});

export const attendeeSessions = pgTable(
  "attendee_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attendee_sessions_event_idx").on(t.eventId)],
);

export const eventMembers = pgTable(
  "event_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    attendeeSessionId: uuid("attendee_session_id").references(() => attendeeSessions.id, {
      onDelete: "cascade",
    }),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_members_user_idx").on(t.eventId, t.userId),
    uniqueIndex("event_members_attendee_idx").on(t.eventId, t.attendeeSessionId),
    index("event_members_event_idx").on(t.eventId),
  ],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => eventMembers.id),
    storageKey: text("storage_key").notNull(),
    thumbKey: text("thumb_key"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    duration: doublePrecision("duration"),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("media_event_idx").on(t.eventId, t.status, t.uploadedAt)],
);

export const mediaCredits = pgTable(
  "media_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => eventMembers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_credits_contributor_idx").on(t.contributorId)],
);

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => eventMembers.id),
    mediaId: uuid("media_id").references(() => media.id),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    fileHash: text("file_hash"),
    storageKey: text("storage_key"),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("uploads_event_idx").on(t.eventId, t.createdAt),
    index("uploads_contributor_idx").on(t.contributorId, t.createdAt),
  ],
);

export const downloadJobs = pgTable(
  "download_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by").references(() => users.id),
    scope: text("scope").notNull(),
    status: text("status").notNull(),
    storageKey: text("storage_key"),
    fileCount: integer("file_count"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("download_jobs_event_idx").on(t.eventId, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    attendeeSessionId: uuid("attendee_session_id").references(() => attendeeSessions.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_attendee_idx").on(t.attendeeSessionId)],
);

export const joinAttempts = pgTable(
  "join_attempts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("join_attempts_ip_idx").on(t.ip, t.createdAt)],
);
