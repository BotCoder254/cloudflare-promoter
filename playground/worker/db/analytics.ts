import { and, desc, eq, sql } from "drizzle-orm"

import { dailyStatsTable, linksTable, visitsTable } from "../../src/shared/db/schema"
import type { AnalyticsResponse, DashboardSummaryResponse, DailyStatSummary, VisitActivity } from "../../src/shared/models"
import type { DatabaseClient } from "./types"

const nowIso = (): string => new Date().toISOString()

const today = (): string => new Date().toISOString().slice(0, 10)

const isExpiredAt = (expiresAt?: string | null): boolean => {
  if (!expiresAt) {
    return false
  }

  return new Date(expiresAt).getTime() <= Date.now()
}

const toVisitActivity = (item: {
  id: string
  visitedAt: string
  referrer: string | null
  country: string | null
  isUnique: boolean
  slug: string
  title: string
}): VisitActivity => ({
  id: item.id,
  visitedAt: item.visitedAt,
  referrer: item.referrer,
  country: item.country,
  isUnique: item.isUnique,
  slug: item.slug,
  title: item.title,
})

const toDailySummary = (item: { date: string; clicks: number; uniques: number }): DailyStatSummary => ({
  date: item.date,
  clicks: Number(item.clicks ?? 0),
  uniques: Number(item.uniques ?? 0),
})

const hashValue = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("")
}

export const listRecentVisitsForUser = async (
  db: DatabaseClient,
  userId: string,
  limit = 10,
): Promise<VisitActivity[]> => {
  const rows = await db
    .select({
      id: visitsTable.id,
      visitedAt: visitsTable.visitedAt,
      referrer: visitsTable.referrer,
      country: visitsTable.country,
      isUnique: visitsTable.isUnique,
      slug: linksTable.slug,
      title: linksTable.title,
    })
    .from(visitsTable)
    .innerJoin(linksTable, eq(visitsTable.linkId, linksTable.id))
    .where(and(eq(visitsTable.ownerId, userId), eq(linksTable.ownerId, userId)))
    .orderBy(desc(visitsTable.visitedAt))
    .limit(limit)

  return rows.map((item) =>
    toVisitActivity({
      id: item.id,
      visitedAt: item.visitedAt,
      referrer: item.referrer,
      country: item.country,
      isUnique: item.isUnique,
      slug: item.slug,
      title: item.title,
    }),
  )
}

export const listRecentVisitsForLink = async (
  db: DatabaseClient,
  linkId: string,
  userId: string,
  limit = 10,
): Promise<VisitActivity[]> => {
  const rows = await db
    .select({
      id: visitsTable.id,
      visitedAt: visitsTable.visitedAt,
      referrer: visitsTable.referrer,
      country: visitsTable.country,
      isUnique: visitsTable.isUnique,
      slug: linksTable.slug,
      title: linksTable.title,
    })
    .from(visitsTable)
    .innerJoin(linksTable, eq(visitsTable.linkId, linksTable.id))
    .where(and(eq(visitsTable.linkId, linkId), eq(visitsTable.ownerId, userId), eq(linksTable.ownerId, userId)))
    .orderBy(desc(visitsTable.visitedAt))
    .limit(limit)

  return rows.map((item) =>
    toVisitActivity({
      id: item.id,
      visitedAt: item.visitedAt,
      referrer: item.referrer,
      country: item.country,
      isUnique: item.isUnique,
      slug: item.slug,
      title: item.title,
    }),
  )
}

export const getAnalyticsForLink = async (
  db: DatabaseClient,
  linkId: string,
  userId: string,
): Promise<AnalyticsResponse | null> => {
  const [link] = await db
    .select({
      id: linksTable.id,
      clicks: linksTable.clicks,
      uniqueClicks: linksTable.uniqueClicks,
      ownerId: linksTable.ownerId,
    })
    .from(linksTable)
    .where(and(eq(linksTable.id, linkId), eq(linksTable.ownerId, userId)))
    .limit(1)

  if (!link) {
    return null
  }

  const dailyRows = await db
    .select({
      date: dailyStatsTable.date,
      clicks: dailyStatsTable.clicks,
      uniques: dailyStatsTable.uniques,
    })
    .from(dailyStatsTable)
    .where(eq(dailyStatsTable.linkId, linkId))
    .orderBy(dailyStatsTable.date)

  return {
    linkId,
    totals: {
      clicks: link.clicks,
      uniques: link.uniqueClicks,
    },
    daily: dailyRows.map(toDailySummary),
    recentVisits: await listRecentVisitsForLink(db, linkId, userId, 12),
  }
}

export const getDashboardSummaryForUser = async (db: DatabaseClient, userId: string): Promise<DashboardSummaryResponse> => {
  const links = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.ownerId, userId), sql`${linksTable.archivedAt} IS NULL`))

  const now = Date.now()
  const totals = {
    links: links.length,
    activeLinks: links.filter((item) => item.status === "active").length,
    pausedLinks: links.filter((item) => item.status === "paused").length,
    privateLinks: links.filter((item) => item.isPrivate).length,
    expiredLinks: links.filter((item) => (item.expiresAt ? new Date(item.expiresAt).getTime() <= now : false)).length,
    clicks: links.reduce((sum, item) => sum + item.clicks, 0),
    uniques: links.reduce((sum, item) => sum + item.uniqueClicks, 0),
  }

  const trendRows = await db
    .select({
      date: dailyStatsTable.date,
      clicks: sql<number>`sum(${dailyStatsTable.clicks})`,
      uniques: sql<number>`sum(${dailyStatsTable.uniques})`,
    })
    .from(dailyStatsTable)
    .innerJoin(linksTable, eq(dailyStatsTable.linkId, linksTable.id))
    .where(and(eq(linksTable.ownerId, userId), sql`${linksTable.archivedAt} IS NULL`))
    .groupBy(dailyStatsTable.date)
    .orderBy(dailyStatsTable.date)

  const recentActivity = await listRecentVisitsForUser(db, userId, 8)

  return {
    totals,
    trend: trendRows.map(toDailySummary),
    topLinks: [...links]
      .sort((left, right) => right.clicks - left.clicks)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        clicks: item.clicks,
        status: item.status === "paused" ? "paused" : "active",
        isExpired: isExpiredAt(item.expiresAt),
        oneTime: item.oneTime,
        requiresPassword: item.requiresPassword,
        isPrivate: item.isPrivate,
        isConsumed: Boolean(item.oneTime && item.consumedAt),
        lastVisitedAt: item.lastVisitedAt ?? null,
      })),
    recentActivity,
  }
}

export const recordRedirectVisitByLinkId = async (db: DatabaseClient, linkId: string, request: Request): Promise<void> => {
  const [link] = await db
    .select({
      id: linksTable.id,
      ownerId: linksTable.ownerId,
    })
    .from(linksTable)
    .where(eq(linksTable.id, linkId))
    .limit(1)

  if (!link) {
    return
  }

  await recordRedirectVisit(db, link, request)
}

export const recordRedirectVisit = async (
  db: DatabaseClient,
  link: {
    id: string
    ownerId: string
  },
  request: Request,
): Promise<void> => {
  const timestamp = nowIso()
  const day = today()

  const connectingIp = request.headers.get("cf-connecting-ip")
  const userAgent = request.headers.get("user-agent")
  const referrer = request.headers.get("referer")
  const country = request.headers.get("cf-ipcountry")

  const ipHash = connectingIp ? await hashValue(`${connectingIp}|${userAgent ?? ""}`) : null

  let isUnique = true
  if (ipHash) {
    const [existingVisit] = await db
      .select({ id: visitsTable.id })
      .from(visitsTable)
      .where(and(eq(visitsTable.linkId, link.id), eq(visitsTable.visitDay, day), eq(visitsTable.ipHash, ipHash)))
      .limit(1)

    isUnique = !existingVisit
  }

  await db.insert(visitsTable).values({
    id: crypto.randomUUID(),
    linkId: link.id,
    ownerId: link.ownerId,
    visitDay: day,
    visitedAt: timestamp,
    referrer,
    userAgent,
    country,
    ipHash,
    isUnique,
  })

  await db
    .update(linksTable)
    .set({
      clicks: sql`${linksTable.clicks} + 1`,
      uniqueClicks: isUnique ? sql`${linksTable.uniqueClicks} + 1` : sql`${linksTable.uniqueClicks}`,
      lastVisitedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(linksTable.id, link.id))

  await db
    .insert(dailyStatsTable)
    .values({
      id: crypto.randomUUID(),
      linkId: link.id,
      date: day,
      clicks: 1,
      uniques: isUnique ? 1 : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [dailyStatsTable.linkId, dailyStatsTable.date],
      set: {
        clicks: sql`${dailyStatsTable.clicks} + 1`,
        uniques: isUnique ? sql`${dailyStatsTable.uniques} + 1` : dailyStatsTable.uniques,
        updatedAt: timestamp,
      },
    })
}
