import { drizzle } from "drizzle-orm/d1"

import * as schema from "../src/shared/db/schema"
import type { WorkerEnv } from "./env"

export const createDatabaseClient = (env: WorkerEnv) => {
  if (!env.DB) {
    return null
  }

  return drizzle(env.DB, { schema })
}
