import { sql } from "drizzle-orm"

import type { DatabaseClient } from "./types"

export const checkDatabaseConnectivity = async (db: DatabaseClient): Promise<number> => {
  const start = Date.now()
  await db.select({ value: sql<number>`1` })
  return Date.now() - start
}
