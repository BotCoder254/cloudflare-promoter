export interface WorkerEnv {
  DB?: D1Database
  LINKS_CACHE?: KVNamespace
  RATE_LIMIT_KV?: KVNamespace
  ASSET_BUCKET?: R2Bucket
  ASSETS?: Fetcher
  BETTER_AUTH_SECRET?: string
  LINK_UNLOCK_SECRET?: string
  BETTER_AUTH_URL?: string
  ADMIN_EMAILS?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}
