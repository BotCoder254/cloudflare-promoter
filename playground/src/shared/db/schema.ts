import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const userTable = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
})

export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => userTable.id, { onDelete: "cascade" }),
})

export const accountTable = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
})

export const verificationTable = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
})

export const linksTable = sqliteTable(
  "links",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    destination: text("destination").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
    requiresPassword: integer("requires_password", { mode: "boolean" }).notNull().default(false),
    passwordHash: text("password_hash"),
    oneTime: integer("one_time", { mode: "boolean" }).notNull().default(false),
    expiresAt: text("expires_at"),
    consumedAt: text("consumed_at"),
    clicks: integer("clicks").notNull().default(0),
    uniqueClicks: integer("unique_clicks").notNull().default(0),
    lastVisitedAt: text("last_visited_at"),
    qrCodeUrl: text("qr_code_url"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("links_slug_unique").on(table.slug),
    ownerIdx: index("links_owner_idx").on(table.ownerId),
    ownerStatusIdx: index("links_owner_status_idx").on(table.ownerId, table.status),
    archivedIdx: index("links_archived_idx").on(table.archivedAt),
    expiresIdx: index("links_expires_idx").on(table.expiresAt),
  }),
)

export const visitsTable = sqliteTable(
  "visits",
  {
    id: text("id").primaryKey(),
    linkId: text("link_id")
      .notNull()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    visitDay: text("visit_day").notNull(),
    visitedAt: text("visited_at").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    country: text("country"),
    ipHash: text("ip_hash"),
    isUnique: integer("is_unique", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    linkIdx: index("visits_link_idx").on(table.linkId),
    ownerIdx: index("visits_owner_idx").on(table.ownerId),
    dayIdx: index("visits_day_idx").on(table.visitDay),
    timestampIdx: index("visits_timestamp_idx").on(table.visitedAt),
    uniqueProbeIdx: index("visits_unique_probe_idx").on(table.linkId, table.visitDay, table.ipHash),
  }),
)

export const dailyStatsTable = sqliteTable(
  "daily_stats",
  {
    id: text("id").primaryKey(),
    linkId: text("link_id")
      .notNull()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    clicks: integer("clicks").notNull().default(0),
    uniques: integer("uniques").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    linkDateUnique: uniqueIndex("daily_stats_link_date_unique").on(table.linkId, table.date),
    dateIdx: index("daily_stats_date_idx").on(table.date),
  }),
)

export const securityEventsTable = sqliteTable(
  "security_events",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    eventType: text("event_type").notNull(),
    ownerId: text("owner_id").references(() => userTable.id, { onDelete: "set null" }),
    linkId: text("link_id").references(() => linksTable.id, { onDelete: "set null" }),
    slug: text("slug"),
    ipHash: text("ip_hash"),
    country: text("country"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    requestPath: text("request_path"),
    metadata: text("metadata"),
  },
  (table) => ({
    createdAtIdx: index("security_events_created_at_idx").on(table.createdAt),
    typeIdx: index("security_events_type_idx").on(table.eventType),
    ownerIdx: index("security_events_owner_idx").on(table.ownerId),
    linkIdx: index("security_events_link_idx").on(table.linkId),
    ipHashIdx: index("security_events_ip_hash_idx").on(table.ipHash),
  }),
)

export type UserRecord = typeof userTable.$inferSelect
export type SessionRecord = typeof sessionTable.$inferSelect
export type AccountRecord = typeof accountTable.$inferSelect
export type VerificationRecord = typeof verificationTable.$inferSelect
export type LinkDbRecord = typeof linksTable.$inferSelect
export type VisitDbRecord = typeof visitsTable.$inferSelect
export type DailyStatDbRecord = typeof dailyStatsTable.$inferSelect
export type SecurityEventDbRecord = typeof securityEventsTable.$inferSelect
