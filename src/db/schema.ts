import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const SYNC_SOURCES = [
  "google_calendar",
  "todoist",
  "ftugate",
  "drive",
  "telegram",
  "webpush",
] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];

const PROFILES = ["work", "mlsv", "study", "brain"] as const;

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: SYNC_SOURCES }).notNull(),
    startedAt: tstz("started_at").notNull().defaultNow(),
    finishedAt: tstz("finished_at"),
    status: text("status", { enum: ["running", "success", "error"] }).notNull(),
    itemsCount: integer("items_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("sync_runs_source_started_idx").on(t.source, t.startedAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ip: text("ip").notNull(),
    success: boolean("success").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("login_attempts_ip_created_idx").on(t.ip, t.createdAt)],
);

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    provider: text("provider").notNull(),
    accountEmail: text("account_email").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    scopes: text("scopes").notNull().default(""),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.accountEmail] })],
);

export const ftuSnapshots = pgTable("ftu_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["schedule", "exams", "grades", "notices"] }).notNull(),
  contentHash: text("content_hash").notNull(),
  payload: jsonb("payload").notNull(),
  fetchedAt: tstz("fetched_at").notNull().defaultNow(),
});

export const gradeEvents = pgTable("grade_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseCode: text("course_code").notNull(),
  courseName: text("course_name").notNull(),
  semester: text("semester").notNull(),
  score: jsonb("score").notNull(),
  detectedAt: tstz("detected_at").notNull().defaultNow(),
  notifiedAt: tstz("notified_at"),
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["folder", "shared_drive", "file"] }).notNull(),
  googleId: text("google_id").notNull(),
  label: text("label").notNull(),
  profile: text("profile", { enum: PROFILES }).notNull(),
  extractDeadlines: boolean("extract_deadlines").notNull().default(false),
  changeToken: text("change_token"),
  lastSyncedAt: tstz("last_synced_at"),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  folderGoogleId: text("folder_google_id").notNull(),
  profile: text("profile", { enum: PROFILES }).notNull(),
  status: text("status").notNull().default("active"),
  nextDeadlineAt: tstz("next_deadline_at"),
});

export const files = pgTable("files", {
  id: text("id").primaryKey(), // Google file id
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  path: text("path").notNull(),
  parentId: text("parent_id"),
  modifiedTime: tstz("modified_time"),
  contentHash: text("content_hash"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
});

export const deadlines = pgTable("deadlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  dueAt: tstz("due_at").notNull(),
  rawText: text("raw_text").notNull().default(""),
  confidence: real("confidence").notNull().default(0),
  manualOverride: boolean("manual_override").notNull().default(false),
  dismissed: boolean("dismissed").notNull().default(false),
});

export const courseFolderMap = pgTable("course_folder_map", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseCode: text("course_code").notNull(),
  courseName: text("course_name").notNull(),
  folderGoogleId: text("folder_google_id").notNull(),
  isManual: boolean("is_manual").notNull().default(false),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(), // Google file id
  path: text("path").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  links: text("links").array().notNull().default([]),
  modifiedTime: tstz("modified_time"),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
