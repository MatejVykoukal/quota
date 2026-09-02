import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  uniqueIndex,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const meterKindEnum = pgEnum("meter_kind", ["rate", "quota"]);
export const meterPeriodEnum = pgEnum("meter_period", ["day", "month"]);
export type MeterKind = (typeof meterKindEnum.enumValues)[number];
export type MeterPeriod = (typeof meterPeriodEnum.enumValues)[number];

/**
 * A project groups API keys and meters. Single demo user, so no users table.
 */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * API keys issued for a project. Key is stored hashed; a prefix is kept
 * for display (e.g. "qk_live_ab12…").
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("api_keys_key_hash_idx").on(t.keyHash),
    index("api_keys_project_idx").on(t.projectId),
  ],
);

/**
 * A meter defines a quota/rate limit on a project.
 * kind: "rate"  → max N requests per period seconds (e.g. 100/min)
 * kind: "quota" → max N requests per calendar window (day/month)
 */
export const meters = pgTable(
  "meters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    kind: meterKindEnum("kind").notNull(),
    limit: integer("limit").notNull(),
    periodSeconds: integer("period_seconds"), // for "rate" meters
    period: meterPeriodEnum("period"), // for "quota" meters
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("meters_project_idx").on(t.projectId)],
);

/**
 * One row per (key, meter, window) with an incremented count.
 * window_start anchors the counting period:
 *  - rate meters: fixed slots of periodSeconds (e.g. :00, :60, …)
 *  - quota meters: start of day/month (UTC)
 */
export const usage = pgTable(
  "usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: uuid("api_key_id")
      .references(() => apiKeys.id, { onDelete: "cascade" })
      .notNull(),
    meterId: uuid("meter_id")
      .references(() => meters.id, { onDelete: "cascade",  })
      .notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: bigint("count", { mode: "number" }).default(0).notNull(),
  },
  (t) => [
    uniqueIndex("usage_key_meter_window_idx").on(
      t.apiKeyId,
      t.meterId,
      t.windowStart,
    ),
    index("usage_window_idx").on(t.windowStart),
  ],
);

/**
 * Request log for observability in the dashboard.
 */
export const requests = pgTable(
  "requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    path: text("path").notNull(),
    method: text("method").notNull(),
    status: integer("status").notNull(), // 200 or 429
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("requests_created_idx").on(t.createdAt)],
);

export type Project = typeof projects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Meter = typeof meters.$inferSelect;
export type Usage = typeof usage.$inferSelect;
export type RequestLog = typeof requests.$inferSelect;
