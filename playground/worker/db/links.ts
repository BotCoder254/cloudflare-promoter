import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"

import { linksTable } from "../../src/shared/db/schema"
import {
  LinkListFilterSchema,
  LinkSortBySchema,
  ReservedAppPrefixes,
  SortOrderSchema,
  type CreateLinkInput,
  type BulkLinkAction,
  type LinkListFilter,
  type LinkRecord,
  type LinkSortBy,
  type LinksListResponse,
  type SlugAvailabilityResponse,
  type SortOrder,
  type UpdateLinkInput,
} from "../../src/shared/models"
import type { DatabaseClient } from "./types"

type LinkListQueryOptions = {
  userId: string
  origin: string
  page: number
  pageSize: number
  status: LinkListFilter
  search?: string
  sortBy: LinkSortBy
  sortOrder: SortOrder
}

const nowIso = (): string => new Date().toISOString()

const maxPageSize = 50

const slugAllowedPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const normalizeSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
}

const isExpired = (expiresAt?: string | null): boolean => {
  if (!expiresAt) {
    return false
  }

  return new Date(expiresAt).getTime() <= Date.now()
}

const buildShortUrl = (origin: string, slug: string): string => `${origin}/${slug}`

const buildQrCodeUrl = (shortUrl: string): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shortUrl)}`
}

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }

  const [first, second] = parts
  if (first === 10 || first === 127 || first === 0) {
    return true
  }

  if (first === 169 && second === 254) {
    return true
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true
  }

  if (first === 192 && second === 168) {
    return true
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return true
  }

  return false
}

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase()
  if (normalized === "::1" || normalized === "::") {
    return true
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true
  }

  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true
  }

  return false
}

const assertDestinationAllowed = (destination: string): void => {
  const parsed = new URL(destination)
  const protocol = parsed.protocol.toLowerCase()
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Destination URL must use http or https")
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) {
    throw new Error("Destination hostname is required")
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Destination host is not publicly routable")
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error("Destination IP address is not allowed")
  }
}

const toLinkRecord = (item: typeof linksTable.$inferSelect, origin: string): LinkRecord => {
  const shortUrl = buildShortUrl(origin, item.slug)
  const isConsumed = Boolean(item.oneTime && item.consumedAt)

  return {
    id: item.id,
    ownerId: item.ownerId,
    title: item.title,
    slug: item.slug,
    destination: item.destination,
    description: item.description ?? undefined,
    status: item.status === "paused" ? "paused" : "active",
    isPrivate: item.isPrivate,
    requiresPassword: item.requiresPassword,
    oneTime: item.oneTime,
    expiresAt: item.expiresAt ?? null,
    isExpired: isExpired(item.expiresAt),
    clicks: item.clicks,
    uniqueClicks: item.uniqueClicks,
    qrCodeUrl: item.qrCodeUrl ?? buildQrCodeUrl(shortUrl),
    shortUrl,
    lastVisitedAt: item.lastVisitedAt ?? null,
    consumedAt: item.consumedAt ?? null,
    isConsumed,
    archivedAt: item.archivedAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

const randomSlug = (): string => {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8)
}

export const hashSecret = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("")
}

const getReservedReason = (slug: string): string | null => {
  if (ReservedAppPrefixes.includes(slug as (typeof ReservedAppPrefixes)[number])) {
    return "Slug is reserved by system routes"
  }

  return null
}

export const getSlugAvailability = async (
  db: DatabaseClient,
  slugValue: string,
  excludeId?: string,
): Promise<SlugAvailabilityResponse> => {
  const slug = normalizeSlug(slugValue)

  if (!slugAllowedPattern.test(slug) || slug.length < 3 || slug.length > 40) {
    return {
      slug,
      available: false,
      reason: "Slug must be 3-40 chars using lowercase letters, numbers, and hyphens",
    }
  }

  const reservedReason = getReservedReason(slug)
  if (reservedReason) {
    return {
      slug,
      available: false,
      reason: reservedReason,
    }
  }

  const [existing] = await db.select({ id: linksTable.id }).from(linksTable).where(eq(linksTable.slug, slug)).limit(1)
  if (!existing) {
    return {
      slug,
      available: true,
    }
  }

  if (excludeId && existing.id === excludeId) {
    return {
      slug,
      available: true,
    }
  }

  return {
    slug,
    available: false,
    reason: "Slug is already taken",
  }
}

const resolveSlugForCreate = async (db: DatabaseClient, payload: CreateLinkInput): Promise<string> => {
  if (payload.slugMode === "custom") {
    const availability = await getSlugAvailability(db, payload.slug ?? "")
    if (!availability.available) {
      throw new Error(availability.reason ?? "Slug is unavailable")
    }

    return availability.slug
  }

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const candidate = normalizeSlug(randomSlug())
    const availability = await getSlugAvailability(db, candidate)
    if (availability.available) {
      return candidate
    }
  }

  throw new Error("Unable to generate a unique slug")
}

const toPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
})

const applySort = (sortBy: LinkSortBy, sortOrder: SortOrder) => {
  const direction = sortOrder === "asc" ? asc : desc

  if (sortBy === "createdAt") {
    return direction(linksTable.createdAt)
  }

  if (sortBy === "updatedAt") {
    return direction(linksTable.updatedAt)
  }

  if (sortBy === "clicks") {
    return direction(linksTable.clicks)
  }

  return direction(linksTable.title)
}

const getListConditions = (options: Pick<LinkListQueryOptions, "userId" | "status" | "search">) => {
  const conditions = [eq(linksTable.ownerId, options.userId)]
  const now = nowIso()

  if (options.status === "archived") {
    conditions.push(isNotNull(linksTable.archivedAt))
  } else {
    conditions.push(isNull(linksTable.archivedAt))

    if (options.status === "active") {
      conditions.push(eq(linksTable.status, "active"))
      conditions.push(sql`(${linksTable.expiresAt} IS NULL OR ${linksTable.expiresAt} > ${now})`)
    }

    if (options.status === "paused") {
      conditions.push(eq(linksTable.status, "paused"))
    }

    if (options.status === "private") {
      conditions.push(eq(linksTable.isPrivate, true))
    }

    if (options.status === "expired") {
      conditions.push(sql`${linksTable.expiresAt} IS NOT NULL AND ${linksTable.expiresAt} <= ${now}`)
    }
  }

  if (options.search?.trim()) {
    const searchValue = `%${options.search.trim().toLowerCase()}%`
    conditions.push(
      sql`(lower(${linksTable.title}) LIKE ${searchValue} OR lower(${linksTable.slug}) LIKE ${searchValue} OR lower(${linksTable.destination}) LIKE ${searchValue})`,
    )
  }

  return conditions
}

export const listLinksForUser = async (db: DatabaseClient, options: LinkListQueryOptions): Promise<LinksListResponse> => {
  const page = Math.max(1, options.page)
  const pageSize = Math.min(maxPageSize, Math.max(1, options.pageSize))
  const status = LinkListFilterSchema.parse(options.status)
  const sortBy = LinkSortBySchema.parse(options.sortBy)
  const sortOrder = SortOrderSchema.parse(options.sortOrder)

  const conditions = getListConditions({
    userId: options.userId,
    status,
    search: options.search,
  })

  const whereClause = and(...conditions)
  const orderBy = applySort(sortBy, sortOrder)
  const offset = (page - 1) * pageSize

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(linksTable).where(whereClause)
  const total = Number(countRow?.count ?? 0)

  const rows = await db.select().from(linksTable).where(whereClause).orderBy(orderBy).limit(pageSize).offset(offset)

  return {
    items: rows.map((item) => toLinkRecord(item, options.origin)),
    pagination: toPagination(page, pageSize, total),
    filters: {
      status,
      search: options.search,
      sortBy,
      sortOrder,
    },
  }
}

export const getLinkRowByIdForUser = async (db: DatabaseClient, id: string, userId: string) => {
  const [row] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.ownerId, userId)))
    .limit(1)

  return row ?? null
}

export const getLinkByIdForUser = async (
  db: DatabaseClient,
  id: string,
  userId: string,
  origin: string,
): Promise<LinkRecord | null> => {
  const row = await getLinkRowByIdForUser(db, id, userId)
  return row ? toLinkRecord(row, origin) : null
}

export const findRedirectLinkBySlug = async (db: DatabaseClient, slugValue: string) => {
  const slug = normalizeSlug(slugValue)
  const [row] = await db.select().from(linksTable).where(eq(linksTable.slug, slug)).limit(1)
  return row ?? null
}

export const createLinkForUser = async (
  db: DatabaseClient,
  userId: string,
  payload: CreateLinkInput,
  origin: string,
): Promise<LinkRecord> => {
  assertDestinationAllowed(payload.destination)

  const slug = await resolveSlugForCreate(db, payload)
  const timestamp = nowIso()
  const id = crypto.randomUUID()
  const password = payload.password?.trim()
  const shortUrl = buildShortUrl(origin, slug)

  await db.insert(linksTable).values({
    id,
    ownerId: userId,
    title: payload.title,
    slug,
    destination: payload.destination,
    description: payload.description,
    status: "active",
    isPrivate: payload.isPrivate,
    oneTime: payload.oneTime,
    consumedAt: null,
    expiresAt: payload.expiresAt ?? null,
    requiresPassword: Boolean(password),
    passwordHash: password ? await hashSecret(password) : null,
    clicks: 0,
    uniqueClicks: 0,
    qrCodeUrl: buildQrCodeUrl(shortUrl),
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const [created] = await db.select().from(linksTable).where(eq(linksTable.id, id)).limit(1)
  if (!created) {
    throw new Error("Failed to create link")
  }

  return toLinkRecord(created, origin)
}

export const updateLinkForUser = async (
  db: DatabaseClient,
  id: string,
  userId: string,
  payload: UpdateLinkInput,
  origin: string,
): Promise<LinkRecord | null> => {
  const existing = await getLinkRowByIdForUser(db, id, userId)
  if (!existing) {
    return null
  }

  const nextSlug = payload.slug ? normalizeSlug(payload.slug) : existing.slug
  if (nextSlug !== existing.slug) {
    const availability = await getSlugAvailability(db, nextSlug, id)
    if (!availability.available) {
      throw new Error(availability.reason ?? "Slug is unavailable")
    }
  }

  if (payload.destination) {
    assertDestinationAllowed(payload.destination)
  }

  let requiresPassword = payload.requiresPassword ?? existing.requiresPassword
  let passwordHash = existing.passwordHash
  const nextOneTime = payload.oneTime ?? existing.oneTime

  const nextConsumedAt = (() => {
    if (payload.oneTime === false) {
      return null
    }

    if (payload.oneTime === true && !existing.oneTime) {
      return null
    }

    return existing.consumedAt
  })()

  if (typeof payload.password === "string") {
    requiresPassword = true
    passwordHash = await hashSecret(payload.password)
  }

  if (payload.password === null || requiresPassword === false) {
    requiresPassword = false
    passwordHash = null
  }

  await db
    .update(linksTable)
    .set({
      title: payload.title ?? existing.title,
      slug: nextSlug,
      destination: payload.destination ?? existing.destination,
      description: payload.description ?? existing.description,
      status: payload.status ?? existing.status,
      isPrivate: payload.isPrivate ?? existing.isPrivate,
      expiresAt: payload.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
      oneTime: nextOneTime,
      consumedAt: nextConsumedAt,
      requiresPassword,
      passwordHash,
      qrCodeUrl: buildQrCodeUrl(buildShortUrl(origin, nextSlug)),
      updatedAt: nowIso(),
    })
    .where(and(eq(linksTable.id, id), eq(linksTable.ownerId, userId)))

  return getLinkByIdForUser(db, id, userId, origin)
}

export const toggleStatusForUser = async (
  db: DatabaseClient,
  id: string,
  userId: string,
  origin: string,
): Promise<LinkRecord | null> => {
  const existing = await getLinkRowByIdForUser(db, id, userId)
  if (!existing) {
    return null
  }

  const status = existing.status === "active" ? "paused" : "active"

  await db
    .update(linksTable)
    .set({
      status,
      updatedAt: nowIso(),
    })
    .where(and(eq(linksTable.id, id), eq(linksTable.ownerId, userId)))

  return getLinkByIdForUser(db, id, userId, origin)
}

export const archiveLinkForUser = async (
  db: DatabaseClient,
  id: string,
  userId: string,
  origin: string,
): Promise<LinkRecord | null> => {
  const existing = await getLinkRowByIdForUser(db, id, userId)
  if (!existing) {
    return null
  }

  const timestamp = nowIso()

  await db
    .update(linksTable)
    .set({
      status: "paused",
      archivedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(and(eq(linksTable.id, id), eq(linksTable.ownerId, userId)))

  const [updated] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.ownerId, userId)))
    .limit(1)

  return updated ? toLinkRecord(updated, origin) : null
}

export const runBulkActionForUser = async (
  db: DatabaseClient,
  userId: string,
  action: BulkLinkAction,
  ids: string[],
  origin: string,
): Promise<LinkRecord[]> => {
  const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (!normalizedIds.length) {
    return []
  }

  const timestamp = nowIso()

  if (action === "activate") {
    const updated = await db
      .update(linksTable)
      .set({
        status: "active",
        updatedAt: timestamp,
      })
      .where(and(eq(linksTable.ownerId, userId), inArray(linksTable.id, normalizedIds), isNull(linksTable.archivedAt)))
      .returning()

    return updated.map((item) => toLinkRecord(item, origin))
  }

  if (action === "pause") {
    const updated = await db
      .update(linksTable)
      .set({
        status: "paused",
        updatedAt: timestamp,
      })
      .where(and(eq(linksTable.ownerId, userId), inArray(linksTable.id, normalizedIds), isNull(linksTable.archivedAt)))
      .returning()

    return updated.map((item) => toLinkRecord(item, origin))
  }

  const updated = await db
    .update(linksTable)
    .set({
      status: "paused",
      archivedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(and(eq(linksTable.ownerId, userId), inArray(linksTable.id, normalizedIds), isNull(linksTable.archivedAt)))
    .returning()

  return updated.map((item) => toLinkRecord(item, origin))
}

export const consumeOneTimeLinkById = async (db: DatabaseClient, linkId: string): Promise<boolean> => {
  const timestamp = nowIso()

  const updated = await db
    .update(linksTable)
    .set({
      consumedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(and(eq(linksTable.id, linkId), eq(linksTable.oneTime, true), isNull(linksTable.consumedAt)))
    .returning({ id: linksTable.id })

  return updated.length > 0
}
