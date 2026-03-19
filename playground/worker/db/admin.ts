import { eq, sql } from "drizzle-orm"

import { linksTable, sessionTable, userTable, visitsTable } from "../../src/shared/db/schema"
import type { AdminOverviewResponse } from "../../src/shared/models"
import type { DatabaseClient } from "./types"

export const getAdminOverview = async (db: DatabaseClient): Promise<AdminOverviewResponse> => {
  const now = Date.now()

  const [usersCountRow] = await db.select({ count: sql<number>`count(*)` }).from(userTable)
  const [adminCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userTable)
    .where(eq(userTable.role, "admin"))
  const [activeSessionRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionTable)
    .where(sql`${sessionTable.expiresAt} > ${now}`)
  const [linksCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(linksTable)
    .where(sql`${linksTable.archivedAt} IS NULL`)
  const [visitsCountRow] = await db.select({ count: sql<number>`count(*)` }).from(visitsTable)

  return {
    totalUsers: Number(usersCountRow?.count ?? 0),
    adminUsers: Number(adminCountRow?.count ?? 0),
    activeSessions: Number(activeSessionRow?.count ?? 0),
    totalLinks: Number(linksCountRow?.count ?? 0),
    totalVisits: Number(visitsCountRow?.count ?? 0),
  }
}
