import type { createDatabaseClient } from "../db"

export type DatabaseClient = NonNullable<ReturnType<typeof createDatabaseClient>>
