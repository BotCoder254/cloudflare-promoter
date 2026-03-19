import type { ZodType } from "zod"

import {
  BulkLinksInputSchema,
  BulkLinksResponseSchema,
  AdminOverviewResponseSchema,
  AnalyticsResponseSchema,
  AuthProvidersResponseSchema,
  AuthSessionResponseSchema,
  CreateLinkInputSchema,
  DashboardSummaryResponseSchema,
  HealthResponseSchema,
  LinkDetailResponseSchema,
  LinkResponseSchema,
  LinkListFilterSchema,
  LinkSortBySchema,
  LinksListResponseSchema,
  MutationResultSchema,
  PublicPasswordVerifyInputSchema,
  PublicPasswordVerifyResponseSchema,
  ReservedAppPrefixes,
  SortOrderSchema,
  SettingsResponseSchema,
  SlugAvailabilityResponseSchema,
  UpdateLinkInputSchema,
  VersionResponseSchema,
  type AuthSessionResponse,
  type SessionMeta,
  type SessionUser,
} from "../src/shared/models"
import { createAuth, listAvailableSocialProviders } from "./auth"
import { createDatabaseClient } from "./db"
import { getAdminOverview } from "./db/admin"
import { checkDatabaseConnectivity } from "./db/auth"
import {
  getAnalyticsForLink,
  getDashboardSummaryForUser,
  listRecentVisitsForLink,
  recordRedirectVisit,
  recordRedirectVisitByLinkId,
} from "./db/analytics"
import {
  archiveLinkForUser,
  consumeOneTimeLinkById,
  createLinkForUser,
  findRedirectLinkBySlug,
  getLinkByIdForUser,
  getLinkRowByIdForUser,
  getSlugAvailability,
  hashSecret,
  listLinksForUser,
  runBulkActionForUser,
  toggleStatusForUser,
  updateLinkForUser,
} from "./db/links"
import { getClientIp, logSecurityEvent } from "./db/security"
import type { DatabaseClient } from "./db/types"
import type { WorkerEnv } from "./env"

const APP_NAME = "golinks"
const APP_VERSION = "0.6.0"
const SESSION_ERROR = "A valid session is required for this endpoint"
const LINK_UNLOCK_COOKIE = "golinks_link_unlock"
const LINK_UNLOCK_MAX_AGE_SECONDS = 60 * 5
const REDIRECT_CACHE_VERSION = 1
const REDIRECT_CACHE_TTL_SECONDS = 60 * 60
const REDIRECT_UNAVAILABLE_CACHE_TTL_SECONDS = 60 * 10
const REDIRECT_ONE_TIME_CACHE_TTL_SECONDS = 60 * 5
const RATE_LIMIT_GRACE_SECONDS = 5
const SLUG_ALLOWED_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const RATE_LIMITS = {
  auth: { limit: 40, windowSeconds: 5 * 60 },
  linkCreate: { limit: 15, windowSeconds: 10 * 60 },
  passwordVerify: { limit: 8, windowSeconds: 10 * 60 },
  invalidSlugProbe: { limit: 30, windowSeconds: 5 * 60 },
  missingSlugProbe: { limit: 60, windowSeconds: 5 * 60 },
} as const

const jsonResponse = <T>(payload: T, status = 200, extraHeaders: HeadersInit = {}): Response => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  })
}

const errorResponse = (status: number, error: string, message: string, extraHeaders: HeadersInit = {}): Response => {
  return jsonResponse({ error, message }, status, extraHeaders)
}

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "number") {
    return new Date(value).toISOString()
  }

  if (typeof value === "string") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return new Date().toISOString()
}

const normalizeSession = (rawSession: unknown): AuthSessionResponse => {
  if (!rawSession || typeof rawSession !== "object") {
    return AuthSessionResponseSchema.parse({ user: null, session: null })
  }

  const raw = rawSession as {
    user?: Record<string, unknown>
    session?: Record<string, unknown>
  }

  const user: SessionUser | null = raw.user
    ? {
        id: String(raw.user.id ?? ""),
        email: String(raw.user.email ?? ""),
        name: String(raw.user.name ?? ""),
        role: raw.user.role === "admin" ? "admin" : "user",
        image: typeof raw.user.image === "string" ? raw.user.image : null,
        emailVerified: Boolean(raw.user.emailVerified),
        createdAt: toIsoString(raw.user.createdAt),
        updatedAt: toIsoString(raw.user.updatedAt),
      }
    : null

  const session: SessionMeta | null = raw.session
    ? {
        id: String(raw.session.id ?? ""),
        createdAt: toIsoString(raw.session.createdAt),
        updatedAt: toIsoString(raw.session.updatedAt),
        expiresAt: toIsoString(raw.session.expiresAt),
        ipAddress: typeof raw.session.ipAddress === "string" ? raw.session.ipAddress : null,
        userAgent: typeof raw.session.userAgent === "string" ? raw.session.userAgent : null,
      }
    : null

  const parsed = AuthSessionResponseSchema.safeParse({ user, session })
  if (!parsed.success) {
    return AuthSessionResponseSchema.parse({ user: null, session: null })
  }

  return parsed.data
}

const readBody = async <T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { response: Response }> => {
  try {
    const unknownBody = await request.json()
    const parsed = schema.safeParse(unknownBody)

    if (!parsed.success) {
      return {
        response: errorResponse(400, "validation_error", parsed.error.issues[0]?.message ?? "Invalid body payload"),
      }
    }

    return { data: parsed.data }
  } catch {
    return { response: errorResponse(400, "invalid_json", "Request body must be valid JSON") }
  }
}

type CachedRedirectResolution = {
  v: number
  linkId: string
  slug: string
  destination: string
  status: string
  archived: boolean
  isPrivate: boolean
  requiresPassword: boolean
  oneTime: boolean
  consumedAt: string | null
  expiresAt: string | null
  cachedAt: string
}

type LinkForCacheSync = {
  id: string
  slug: string
  destination: string
  status: string
  archivedAt?: string | null
  isPrivate: boolean
  requiresPassword: boolean
  oneTime: boolean
  consumedAt?: string | null
  expiresAt?: string | null
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

const cacheKey = (slug: string): string => `slug:${slug}`

const rateLimitKey = (scope: string, identifier: string, bucket: number): string => `ratelimit:${scope}:${identifier}:${bucket}`

const normalizeSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
}

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const normalizeIncomingSlug = (value: string): string => {
  return normalizeSlug(safeDecodeURIComponent(value))
}

const toCachedResolution = (link: LinkForCacheSync): CachedRedirectResolution => {
  return {
    v: REDIRECT_CACHE_VERSION,
    linkId: link.id,
    slug: normalizeSlug(link.slug),
    destination: link.destination,
    status: link.status,
    archived: Boolean(link.archivedAt),
    isPrivate: Boolean(link.isPrivate),
    requiresPassword: Boolean(link.requiresPassword),
    oneTime: Boolean(link.oneTime),
    consumedAt: link.consumedAt ?? null,
    expiresAt: link.expiresAt ?? null,
    cachedAt: new Date().toISOString(),
  }
}

const getRedirectCacheTtlSeconds = (resolution: CachedRedirectResolution): number => {
  if (resolution.oneTime) {
    return REDIRECT_ONE_TIME_CACHE_TTL_SECONDS
  }

  const unavailable =
    resolution.archived ||
    resolution.status !== "active" ||
    resolution.isPrivate ||
    (resolution.oneTime && Boolean(resolution.consumedAt))

  if (unavailable) {
    return REDIRECT_UNAVAILABLE_CACHE_TTL_SECONDS
  }

  if (resolution.expiresAt) {
    const expiresAtMs = new Date(resolution.expiresAt).getTime()
    const remainingSeconds = Math.floor((expiresAtMs - Date.now()) / 1000)

    if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
      return REDIRECT_UNAVAILABLE_CACHE_TTL_SECONDS
    }

    return Math.max(60, Math.min(REDIRECT_CACHE_TTL_SECONDS, remainingSeconds))
  }

  if (resolution.requiresPassword) {
    return Math.min(REDIRECT_CACHE_TTL_SECONDS, LINK_UNLOCK_MAX_AGE_SECONDS)
  }

  return REDIRECT_CACHE_TTL_SECONDS
}

const parseCachedResolution = (raw: string): CachedRedirectResolution | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<CachedRedirectResolution>
    if (
      parsed.v !== REDIRECT_CACHE_VERSION ||
      typeof parsed.linkId !== "string" ||
      typeof parsed.slug !== "string" ||
      typeof parsed.destination !== "string" ||
      typeof parsed.status !== "string" ||
      typeof parsed.archived !== "boolean" ||
      typeof parsed.isPrivate !== "boolean" ||
      typeof parsed.requiresPassword !== "boolean" ||
      typeof parsed.oneTime !== "boolean"
    ) {
      return null
    }

    return {
      v: parsed.v,
      linkId: parsed.linkId,
      slug: parsed.slug,
      destination: parsed.destination,
      status: parsed.status,
      archived: parsed.archived,
      isPrivate: parsed.isPrivate,
      requiresPassword: parsed.requiresPassword,
      oneTime: parsed.oneTime,
      consumedAt: typeof parsed.consumedAt === "string" ? parsed.consumedAt : null,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

const getSlugCache = async (env: WorkerEnv, slug: string): Promise<CachedRedirectResolution | null> => {
  if (!env.LINKS_CACHE) {
    return null
  }

  const raw = await env.LINKS_CACHE.get(cacheKey(slug))
  if (!raw) {
    return null
  }

  const parsed = parseCachedResolution(raw)
  if (!parsed || parsed.slug !== slug) {
    await env.LINKS_CACHE.delete(cacheKey(slug))
    return null
  }

  return parsed
}

const putSlugCache = async (env: WorkerEnv, resolution: CachedRedirectResolution): Promise<void> => {
  if (!env.LINKS_CACHE) {
    return
  }

  await env.LINKS_CACHE.put(cacheKey(resolution.slug), JSON.stringify(resolution), {
    expirationTtl: getRedirectCacheTtlSeconds(resolution),
  })
}

const syncSlugCache = async (env: WorkerEnv, link: LinkForCacheSync): Promise<void> => {
  await putSlugCache(env, toCachedResolution(link))
}

const deleteSlugCache = async (env: WorkerEnv, slug: string): Promise<void> => {
  if (!env.LINKS_CACHE) {
    return
  }

  await env.LINKS_CACHE.delete(cacheKey(slug))
}

const getRateLimitKv = (env: WorkerEnv): KVNamespace | null => {
  return env.RATE_LIMIT_KV ?? env.LINKS_CACHE ?? null
}

const sanitizeRateLimitIdentifier = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._|/-]/g, "_")
}

const checkRateLimit = async (
  env: WorkerEnv,
  scope: string,
  identifier: string,
  policy: {
    limit: number
    windowSeconds: number
  },
): Promise<RateLimitResult> => {
  const kv = getRateLimitKv(env)
  if (!kv) {
    return {
      allowed: true,
      remaining: policy.limit,
      retryAfterSeconds: 0,
    }
  }

  const now = nowSeconds()
  const bucket = Math.floor(now / policy.windowSeconds)
  const key = rateLimitKey(scope, sanitizeRateLimitIdentifier(identifier), bucket)
  const currentCount = Number(await kv.get(key)) || 0
  const resetAt = (bucket + 1) * policy.windowSeconds

  if (currentCount >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, resetAt - now),
    }
  }

  const nextCount = currentCount + 1
  await kv.put(key, String(nextCount), {
    expiration: resetAt + RATE_LIMIT_GRACE_SECONDS,
  })

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - nextCount),
    retryAfterSeconds: Math.max(1, resetAt - now),
  }
}

const rateLimitError = (message: string, retryAfterSeconds: number): Response => {
  return errorResponse(429, "rate_limited", message, {
    "retry-after": String(Math.max(1, retryAfterSeconds)),
  })
}

const logSecurityEventSafe = async (
  db: DatabaseClient | null,
  input: {
    eventType: string
    request: Request
    ownerId?: string | null
    linkId?: string | null
    slug?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> => {
  if (!db) {
    return
  }

  try {
    await logSecurityEvent(db, input)
  } catch {
    return
  }
}

type SessionRequirement = {
  normalized: AuthSessionResponse
  raw: NonNullable<unknown>
}

const requireSession = async (request: Request, env: WorkerEnv): Promise<SessionRequirement | Response> => {
  const auth = createAuth(env, request)
  const raw = await auth.api.getSession({ headers: request.headers })
  const normalized = normalizeSession(raw)

  if (!raw || !normalized.user) {
    return errorResponse(401, "unauthorized", SESSION_ERROR)
  }

  return {
    raw,
    normalized,
  }
}

const requireAdmin = async (request: Request, env: WorkerEnv): Promise<SessionRequirement | Response> => {
  const sessionState = await requireSession(request, env)
  if (sessionState instanceof Response) {
    return sessionState
  }

  if (sessionState.normalized.user?.role !== "admin") {
    return errorResponse(403, "forbidden", "Admin role is required")
  }

  return sessionState
}

type PublicUnavailableReason = "not_found" | "paused" | "archived" | "expired" | "private" | "one_time_consumed"

type RedirectLinkState = {
  status: string
  archivedAt?: string | null
  archived?: boolean
  isPrivate: boolean
  requiresPassword: boolean
  oneTime: boolean
  consumedAt: string | null
  expiresAt: string | null
}

type UnlockCookiePayload = {
  slug: string
  linkId: string
  exp: number
}

const getUnlockSecret = (env: WorkerEnv): string | null => {
  return env.LINK_UNLOCK_SECRET ?? env.BETTER_AUTH_SECRET ?? null
}

const base64UrlEncode = (input: Uint8Array): string => {
  let binary = ""
  for (const byte of input) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

const base64UrlDecode = (value: string): Uint8Array | null => {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4 || 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return bytes
  } catch {
    return null
  }
}

const constantTimeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}

const signValue = async (secret: string, value: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  return base64UrlEncode(new Uint8Array(signature))
}

const getUnlockCookieFromRequest = (request: Request): string | null => {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) {
    return null
  }

  const entries = cookieHeader.split(";")
  for (const entry of entries) {
    const [rawName, ...rest] = entry.trim().split("=")
    if (rawName === LINK_UNLOCK_COOKIE) {
      return rest.join("=") || null
    }
  }

  return null
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const buildUnlockToken = async (secret: string, payload: UnlockCookiePayload): Promise<string> => {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
  const encodedPayload = base64UrlEncode(payloadBytes)
  const signature = await signValue(secret, encodedPayload)
  return `${encodedPayload}.${signature}`
}

const verifyUnlockToken = async (
  secret: string,
  token: string | null,
  expectedSlug: string,
  expectedLinkId: string,
): Promise<boolean> => {
  if (!token) {
    return false
  }

  const [encodedPayload, receivedSignature, ...remaining] = token.split(".")
  if (!encodedPayload || !receivedSignature || remaining.length) {
    return false
  }

  const expectedSignature = await signValue(secret, encodedPayload)
  if (!constantTimeEqual(receivedSignature, expectedSignature)) {
    return false
  }

  const decoded = base64UrlDecode(encodedPayload)
  if (!decoded) {
    return false
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as Partial<UnlockCookiePayload>
    if (typeof parsed.exp !== "number" || typeof parsed.slug !== "string" || typeof parsed.linkId !== "string") {
      return false
    }

    if (parsed.exp <= nowSeconds()) {
      return false
    }

    return parsed.slug === expectedSlug && parsed.linkId === expectedLinkId
  } catch {
    return false
  }
}

const buildUnlockCookieHeader = (token: string, secure: boolean): string => {
  const secureSuffix = secure ? "; Secure" : ""
  return `${LINK_UNLOCK_COOKIE}=${token}; Max-Age=${LINK_UNLOCK_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`
}

const buildUnavailablePath = (slug: string, reason: PublicUnavailableReason): string => {
  return `/link/${encodeURIComponent(slug)}/unavailable?reason=${encodeURIComponent(reason)}`
}

const buildPasswordPath = (slug: string): string => {
  return `/link/${encodeURIComponent(slug)}/password`
}

const getPublicUnavailableReason = (link: RedirectLinkState): PublicUnavailableReason | null => {
  if (link.archived || link.archivedAt) {
    return "archived"
  }

  if (link.status !== "active") {
    return "paused"
  }

  if (link.isPrivate) {
    return "private"
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    return "expired"
  }

  if (link.oneTime && link.consumedAt) {
    return "one_time_consumed"
  }

  return null
}

const handleApi = async (request: Request, url: URL, env: WorkerEnv, databaseConfigured: boolean): Promise<Response> => {
  const { pathname } = url

  if (pathname === "/api/version") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/version")
    }

    const payload = VersionResponseSchema.parse({
      app: APP_NAME,
      version: APP_VERSION,
      runtime: "cloudflare-workers",
      databaseConfigured,
    })

    return jsonResponse(payload)
  }

  if (pathname === "/api/providers") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/providers")
    }

    const payload = AuthProvidersResponseSchema.parse({
      socialProviders: listAvailableSocialProviders(env),
    })

    return jsonResponse(payload)
  }

  if (pathname === "/api/session") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/session")
    }

    const auth = createAuth(env, request)
    const session = await auth.api.getSession({ headers: request.headers })
    const payload = AuthSessionResponseSchema.parse(normalizeSession(session))
    return jsonResponse(payload)
  }

  if (pathname === "/api/settings") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/settings")
    }

    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const auth = createAuth(env, request)
    const accounts = await auth.api.listUserAccounts({ headers: request.headers })
    const linkedProviders = accounts
      .filter((account) => account.providerId === "credential" || account.providerId === "github" || account.providerId === "google")
      .map((account) => ({
        providerId: account.providerId,
        accountId: account.accountId,
        scope: account.scopes.length ? account.scopes.join(" ") : undefined,
        createdAt: toIsoString(account.createdAt),
      }))

    const payload = SettingsResponseSchema.parse({
      user: sessionState.normalized.user,
      linkedProviders,
      availableSocialProviders: listAvailableSocialProviders(env),
      preferences: {
        timezone: "UTC",
        defaultDomain: "go.links",
        reduceMotion: false,
      },
    })

    return jsonResponse(payload)
  }
  const db = createDatabaseClient(env)
  if (!db) {
    return errorResponse(500, "database_missing", "D1 binding 'DB' is required")
  }

  if (pathname === "/api/admin/overview") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/admin/overview")
    }

    const adminSession = await requireAdmin(request, env)
    if (adminSession instanceof Response) {
      return adminSession
    }

    const payload = AdminOverviewResponseSchema.parse(await getAdminOverview(db))
    return jsonResponse(payload)
  }

  if (pathname === "/api/links/check-slug") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/links/check-slug")
    }

    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const slug = normalizeSlug(url.searchParams.get("slug") ?? "")
    if (!slug || slug.length < 3) {
      return errorResponse(400, "invalid_slug", "Slug must contain at least 3 characters")
    }

    const payload = SlugAvailabilityResponseSchema.safeParse(await getSlugAvailability(db, slug))

    if (!payload.success) {
      return errorResponse(400, "invalid_slug", "Slug format is invalid")
    }

    return jsonResponse(payload.data)
  }

  if (pathname.startsWith("/api/public/links/")) {
    const segments = pathname
      .slice("/api/public/links/".length)
      .split("/")
      .filter(Boolean)

    if (segments.length !== 2 || segments[1] !== "verify-password") {
      return errorResponse(404, "not_found", "Public link endpoint not found")
    }

    if (request.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Use POST for /api/public/links/:slug/verify-password")
    }

    const slug = normalizeIncomingSlug(segments[0] ?? "")
    if (!slug || !SLUG_ALLOWED_PATTERN.test(slug)) {
      await logSecurityEventSafe(db, {
        eventType: "password_verify_invalid_slug",
        request,
        slug,
      })
      return errorResponse(400, "invalid_slug", "Slug format is invalid")
    }

    const passwordRateLimit = await checkRateLimit(
      env,
      "password-verify",
      `${slug}:${getClientIp(request)}`,
      RATE_LIMITS.passwordVerify,
    )
    if (!passwordRateLimit.allowed) {
      await logSecurityEventSafe(db, {
        eventType: "password_verify_rate_limited",
        request,
        slug,
        metadata: {
          retryAfterSeconds: passwordRateLimit.retryAfterSeconds,
        },
      })

      return rateLimitError("Too many password attempts. Please try again shortly.", passwordRateLimit.retryAfterSeconds)
    }

    const parsed = await readBody(request, PublicPasswordVerifyInputSchema)
    if ("response" in parsed) {
      return parsed.response
    }

    const link = await findRedirectLinkBySlug(db, slug)
    if (!link) {
      await logSecurityEventSafe(db, {
        eventType: "password_verify_link_not_found",
        request,
        slug,
      })
      return errorResponse(404, "link_not_found", "The requested link was not found")
    }

    const unavailableReason = getPublicUnavailableReason(link)
    if (unavailableReason) {
      await logSecurityEventSafe(db, {
        eventType: "password_verify_policy_blocked",
        request,
        ownerId: link.ownerId,
        linkId: link.id,
        slug,
        metadata: {
          reason: unavailableReason,
        },
      })
      return errorResponse(409, "link_unavailable", "This link is currently unavailable")
    }

    if (!link.requiresPassword) {
      const payload = PublicPasswordVerifyResponseSchema.parse({
        success: true,
        redirectTo: `/${slug}`,
        message: "Password is not required for this link",
      })

      return jsonResponse(payload)
    }

    if (!link.passwordHash) {
      return errorResponse(409, "password_config_error", "Password protection is not configured for this link")
    }

    const incomingHash = await hashSecret(parsed.data.password)
    if (incomingHash !== link.passwordHash) {
      await logSecurityEventSafe(db, {
        eventType: "password_verify_failed",
        request,
        ownerId: link.ownerId,
        linkId: link.id,
        slug,
      })
      return errorResponse(401, "invalid_password", "Password is incorrect")
    }

    const unlockSecret = getUnlockSecret(env)
    if (!unlockSecret) {
      return errorResponse(500, "unlock_unavailable", "Password unlock is not configured")
    }

    const token = await buildUnlockToken(unlockSecret, {
      slug,
      linkId: link.id,
      exp: nowSeconds() + LINK_UNLOCK_MAX_AGE_SECONDS,
    })

    const payload = PublicPasswordVerifyResponseSchema.parse({
      success: true,
      redirectTo: `/${slug}`,
      message: "Password verified",
    })

    return jsonResponse(payload, 200, {
      "set-cookie": buildUnlockCookieHeader(token, url.protocol === "https:"),
    })
  }

  if (pathname === "/api/links") {
    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const userId = sessionState.normalized.user!.id

    if (request.method === "GET") {
      const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1)
      const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? "12") || 12)
      const status = LinkListFilterSchema.catch("all").parse(url.searchParams.get("status") ?? "all")
      const sortBy = LinkSortBySchema.catch("updatedAt").parse(url.searchParams.get("sortBy") ?? "updatedAt")
      const sortOrder = SortOrderSchema.catch("desc").parse(url.searchParams.get("sortOrder") ?? "desc")
      const search = (url.searchParams.get("search") ?? "").trim() || undefined

      const payload = LinksListResponseSchema.parse(
        await listLinksForUser(db, {
          userId,
          origin: url.origin,
          page,
          pageSize,
          status,
          search,
          sortBy,
          sortOrder,
        }),
      )

      return jsonResponse(payload)
    }

    if (request.method === "POST") {
      const createRateLimit = await checkRateLimit(
        env,
        "links-create",
        `${userId}:${getClientIp(request)}`,
        RATE_LIMITS.linkCreate,
      )
      if (!createRateLimit.allowed) {
        await logSecurityEventSafe(db, {
          eventType: "link_create_rate_limited",
          request,
          ownerId: userId,
          metadata: {
            retryAfterSeconds: createRateLimit.retryAfterSeconds,
          },
        })

        return rateLimitError("You are creating links too quickly. Please wait and try again.", createRateLimit.retryAfterSeconds)
      }

      const parsed = await readBody(request, CreateLinkInputSchema)
      if ("response" in parsed) {
        return parsed.response
      }

      try {
        const item = await createLinkForUser(db, userId, parsed.data, url.origin)
        await syncSlugCache(env, item)

        const payload = LinkResponseSchema.parse({ item })
        return jsonResponse(payload, 201)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create link"
        if (message.toLowerCase().includes("destination")) {
          await logSecurityEventSafe(db, {
            eventType: "link_create_destination_blocked",
            request,
            ownerId: userId,
            metadata: {
              destination: parsed.data.destination,
            },
          })
          return errorResponse(400, "invalid_destination", message)
        }

        return errorResponse(409, "slug_conflict", message)
      }
    }

    return errorResponse(405, "method_not_allowed", "Use GET or POST for /api/links")
  }

  if (pathname === "/api/links/bulk") {
    if (request.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Use POST for /api/links/bulk")
    }

    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const parsed = await readBody(request, BulkLinksInputSchema)
    if ("response" in parsed) {
      return parsed.response
    }

    const updated = await runBulkActionForUser(db, sessionState.normalized.user!.id, parsed.data.action, parsed.data.ids, url.origin)
    for (const item of updated) {
      await syncSlugCache(env, item)
    }

    const payload = BulkLinksResponseSchema.parse({
      success: true,
      message: "Bulk action completed",
      affected: updated.length,
    })

    return jsonResponse(payload)
  }

  if (pathname.startsWith("/api/links/")) {
    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const userId = sessionState.normalized.user!.id
    const segments = pathname
      .slice("/api/links/".length)
      .split("/")
      .filter(Boolean)

    if (!segments.length || segments.length > 2) {
      return errorResponse(404, "not_found", "Link endpoint not found")
    }

    const linkId = decodeURIComponent(segments[0])

    if (!linkId) {
      return errorResponse(404, "not_found", "Link endpoint not found")
    }

    if (segments.length === 2 && segments[1] === "toggle-status") {
      if (request.method !== "POST") {
        return errorResponse(405, "method_not_allowed", "Use POST for /api/links/:id/toggle-status")
      }

      const item = await toggleStatusForUser(db, linkId, userId, url.origin)
      if (!item) {
        return errorResponse(404, "link_not_found", "The requested link was not found")
      }

      await syncSlugCache(env, item)

      const payload = LinkResponseSchema.parse({ item })
      return jsonResponse(payload)
    }

    if (segments.length > 1) {
      return errorResponse(404, "not_found", "Link endpoint not found")
    }

    if (request.method === "GET") {
      const item = await getLinkByIdForUser(db, linkId, userId, url.origin)
      if (!item) {
        return errorResponse(404, "link_not_found", "The requested link was not found")
      }

      const analytics = await getAnalyticsForLink(db, linkId, userId)
      const payload = LinkDetailResponseSchema.parse({
        item,
        analyticsSummary: {
          clicks: analytics?.totals.clicks ?? item.clicks,
          uniques: analytics?.totals.uniques ?? item.uniqueClicks,
          last7Days: (analytics?.daily ?? []).slice(-7),
        },
        recentVisits: await listRecentVisitsForLink(db, linkId, userId, 8),
      })

      return jsonResponse(payload)
    }

    if (request.method === "PATCH") {
      const before = await getLinkRowByIdForUser(db, linkId, userId)
      if (!before) {
        return errorResponse(404, "link_not_found", "The requested link was not found")
      }

      const parsed = await readBody(request, UpdateLinkInputSchema)
      if ("response" in parsed) {
        return parsed.response
      }

      try {
        const item = await updateLinkForUser(db, linkId, userId, parsed.data, url.origin)
        if (!item) {
          return errorResponse(404, "link_not_found", "The requested link was not found")
        }

        if (before.slug !== item.slug) {
          await deleteSlugCache(env, before.slug)
        }

        await syncSlugCache(env, item)

        const payload = LinkResponseSchema.parse({ item })
        return jsonResponse(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update link"
        if (message.toLowerCase().includes("destination")) {
          await logSecurityEventSafe(db, {
            eventType: "link_update_destination_blocked",
            request,
            ownerId: userId,
            linkId,
          })
          return errorResponse(400, "invalid_destination", message)
        }

        return errorResponse(409, "slug_conflict", message)
      }
    }

    if (request.method === "DELETE") {
      const item = await archiveLinkForUser(db, linkId, userId, url.origin)
      if (!item) {
        return errorResponse(404, "link_not_found", "The requested link was not found")
      }

      await deleteSlugCache(env, item.slug)
      const payload = MutationResultSchema.parse({ success: true, message: "Link deleted" })
      return jsonResponse(payload)
    }

    return errorResponse(405, "method_not_allowed", "Use GET, PATCH, or DELETE for /api/links/:id")
  }

  if (pathname.startsWith("/api/analytics/")) {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/analytics/:id")
    }

    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const userId = sessionState.normalized.user!.id
    const linkId = decodeURIComponent(pathname.slice("/api/analytics/".length))
    const analytics = await getAnalyticsForLink(db, linkId, userId)

    if (!analytics) {
      return errorResponse(404, "analytics_not_found", "No analytics found for this link")
    }

    const payload = AnalyticsResponseSchema.parse(analytics)
    return jsonResponse(payload)
  }

  if (pathname === "/api/dashboard/summary" || pathname === "/api/dashboard/overview") {
    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Use GET for /api/dashboard/summary")
    }

    const sessionState = await requireSession(request, env)
    if (sessionState instanceof Response) {
      return sessionState
    }

    const payload = DashboardSummaryResponseSchema.parse(await getDashboardSummaryForUser(db, sessionState.normalized.user!.id))

    return jsonResponse(payload)
  }

  return errorResponse(404, "api_not_found", "The API endpoint does not exist")
}

const waitUntilSafe = (ctx: ExecutionContext, promise: Promise<unknown>): void => {
  ctx.waitUntil(
    promise.catch((error) => {
      console.warn("[golinks] background task failed", error)
    }),
  )
}

const handlePublicRequest = async (request: Request, url: URL, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> => {
  if (!env.ASSETS) {
    return new Response("Assets binding is not configured", { status: 500 })
  }

  const segments = url.pathname.split("/").filter(Boolean)
  if (segments.length !== 1) {
    return env.ASSETS.fetch(request)
  }

  const rawSegment = segments[0] ?? ""
  const rawDecodedSegment = safeDecodeURIComponent(rawSegment).trim().toLowerCase()
  const slug = normalizeIncomingSlug(rawSegment)
  if (!slug || ReservedAppPrefixes.includes(slug as (typeof ReservedAppPrefixes)[number])) {
    return env.ASSETS.fetch(request)
  }

  const slugSanitized = rawDecodedSegment !== slug
  if (slugSanitized || !SLUG_ALLOWED_PATTERN.test(slug)) {
    const invalidProbeLimit = await checkRateLimit(env, "redirect-invalid-slug", getClientIp(request), RATE_LIMITS.invalidSlugProbe)
    const db = createDatabaseClient(env)

    waitUntilSafe(
      ctx,
      logSecurityEventSafe(db, {
        eventType: "redirect_invalid_slug_probe",
        request,
        slug,
        metadata: {
          rawSegment,
          rawDecodedSegment,
          slugSanitized,
        },
      }),
    )

    if (!invalidProbeLimit.allowed) {
      return rateLimitError("Too many invalid short-link attempts. Please wait and try again.", invalidProbeLimit.retryAfterSeconds)
    }
  }

  const db = createDatabaseClient(env)
  const cachedResolution = await getSlugCache(env, slug)
  if (cachedResolution) {
    const cachedUnavailableReason = getPublicUnavailableReason(cachedResolution)
    if (cachedUnavailableReason) {
      return Response.redirect(new URL(buildUnavailablePath(slug, cachedUnavailableReason), url.origin).toString(), 302)
    }

    if (cachedResolution.requiresPassword) {
      const unlockSecret = getUnlockSecret(env)
      const unlockToken = getUnlockCookieFromRequest(request)
      const isUnlocked = unlockSecret
        ? await verifyUnlockToken(unlockSecret, unlockToken, slug, cachedResolution.linkId)
        : false

      if (!isUnlocked) {
        return Response.redirect(new URL(buildPasswordPath(slug), url.origin).toString(), 302)
      }
    }

    if (cachedResolution.oneTime) {
      if (!db) {
        return Response.redirect(new URL(buildUnavailablePath(slug, "one_time_consumed"), url.origin).toString(), 302)
      }

      const consumed = await consumeOneTimeLinkById(db, cachedResolution.linkId)
      if (!consumed) {
        await putSlugCache(
          env,
          toCachedResolution({
            id: cachedResolution.linkId,
            slug,
            destination: cachedResolution.destination,
            status: cachedResolution.status,
            archivedAt: cachedResolution.archived ? new Date().toISOString() : null,
            isPrivate: cachedResolution.isPrivate,
            requiresPassword: cachedResolution.requiresPassword,
            oneTime: true,
            consumedAt: cachedResolution.consumedAt ?? new Date().toISOString(),
            expiresAt: cachedResolution.expiresAt,
          }),
        )

        return Response.redirect(new URL(buildUnavailablePath(slug, "one_time_consumed"), url.origin).toString(), 302)
      }

      await putSlugCache(
        env,
        toCachedResolution({
          id: cachedResolution.linkId,
          slug,
          destination: cachedResolution.destination,
          status: cachedResolution.status,
          archivedAt: cachedResolution.archived ? new Date().toISOString() : null,
          isPrivate: cachedResolution.isPrivate,
          requiresPassword: cachedResolution.requiresPassword,
          oneTime: true,
          consumedAt: new Date().toISOString(),
          expiresAt: cachedResolution.expiresAt,
        }),
      )
    }

    if (db) {
      waitUntilSafe(ctx, recordRedirectVisitByLinkId(db, cachedResolution.linkId, request))
    }

    return Response.redirect(cachedResolution.destination, 302)
  }

  if (!db) {
    return env.ASSETS.fetch(request)
  }

  const link = await findRedirectLinkBySlug(db, slug)
  if (!link) {
    const missingProbeLimit = await checkRateLimit(env, "redirect-missing-slug", getClientIp(request), RATE_LIMITS.missingSlugProbe)
    waitUntilSafe(
      ctx,
      logSecurityEventSafe(db, {
        eventType: "redirect_slug_not_found",
        request,
        slug,
        metadata: {
          retryAfterSeconds: missingProbeLimit.retryAfterSeconds,
          rateLimited: !missingProbeLimit.allowed,
        },
      }),
    )

    if (!missingProbeLimit.allowed) {
      return rateLimitError("Too many unknown short-link attempts. Please try again later.", missingProbeLimit.retryAfterSeconds)
    }

    return Response.redirect(new URL(buildUnavailablePath(slug, "not_found"), url.origin).toString(), 302)
  }

  const unavailableReason = getPublicUnavailableReason(link)
  if (unavailableReason) {
    await syncSlugCache(env, link)

    if (unavailableReason !== "paused") {
      waitUntilSafe(
        ctx,
        logSecurityEventSafe(db, {
          eventType: "redirect_policy_blocked",
          request,
          ownerId: link.ownerId,
          linkId: link.id,
          slug,
          metadata: {
            reason: unavailableReason,
          },
        }),
      )
    }

    return Response.redirect(new URL(buildUnavailablePath(slug, unavailableReason), url.origin).toString(), 302)
  }

  if (link.requiresPassword) {
    const unlockSecret = getUnlockSecret(env)
    const unlockToken = getUnlockCookieFromRequest(request)
    const isUnlocked = unlockSecret
      ? await verifyUnlockToken(unlockSecret, unlockToken, slug, link.id)
      : false

    if (!isUnlocked) {
      await syncSlugCache(env, link)
      return Response.redirect(new URL(buildPasswordPath(slug), url.origin).toString(), 302)
    }
  }

  if (link.oneTime) {
    const consumed = await consumeOneTimeLinkById(db, link.id)
    if (!consumed) {
      await putSlugCache(
        env,
        toCachedResolution({
          ...link,
          consumedAt: link.consumedAt ?? new Date().toISOString(),
        }),
      )

      return Response.redirect(new URL(buildUnavailablePath(slug, "one_time_consumed"), url.origin).toString(), 302)
    }

    await putSlugCache(
      env,
      toCachedResolution({
        ...link,
        consumedAt: new Date().toISOString(),
      }),
    )
  } else {
    await syncSlugCache(env, link)
  }

  waitUntilSafe(
    ctx,
    recordRedirectVisit(
      db,
      {
        id: link.id,
        ownerId: link.ownerId,
      },
      request,
    ),
  )

  return Response.redirect(link.destination, 302)
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const db = createDatabaseClient(env)
    const databaseConfigured = db !== null

    if (url.pathname === "/health") {
      if (request.method !== "GET") {
        return errorResponse(405, "method_not_allowed", "Use GET for /health")
      }

      let databaseLatencyMs: number | undefined
      if (db) {
        databaseLatencyMs = await checkDatabaseConnectivity(db)
      }

      const payload = HealthResponseSchema.parse({
        status: "ok",
        app: APP_NAME,
        version: APP_VERSION,
        runtime: "cloudflare-workers",
        timestamp: new Date().toISOString(),
        databaseConfigured,
        databaseLatencyMs,
      })

      return jsonResponse(payload)
    }

    if (url.pathname.startsWith("/api/auth/")) {
      if (request.method !== "GET" && request.method !== "OPTIONS") {
        const authRateLimit = await checkRateLimit(env, "auth", getClientIp(request), RATE_LIMITS.auth)
        if (!authRateLimit.allowed) {
          waitUntilSafe(
            ctx,
            logSecurityEventSafe(db, {
              eventType: "auth_rate_limited",
              request,
              metadata: {
                retryAfterSeconds: authRateLimit.retryAfterSeconds,
                pathname: url.pathname,
              },
            }),
          )

          return rateLimitError("Too many authentication attempts. Please wait and try again.", authRateLimit.retryAfterSeconds)
        }
      }

      try {
        const auth = createAuth(env, request)
        return auth.handler(request)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Authentication subsystem failed to initialize"
        return errorResponse(500, "auth_unavailable", message)
      }
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, url, env, databaseConfigured)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected API error"
        return errorResponse(500, "internal_error", message)
      }
    }

    return handlePublicRequest(request, url, env, ctx)
  },
} satisfies ExportedHandler<WorkerEnv>
