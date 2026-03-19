import { securityEventsTable } from "../../src/shared/db/schema"
import type { DatabaseClient } from "./types"

export type SecurityEventInput = {
  eventType: string
  request: Request
  ownerId?: string | null
  linkId?: string | null
  slug?: string | null
  metadata?: Record<string, unknown>
}

const truncateText = (value: string | null | undefined, maxLength = 512): string | null => {
  if (!value) {
    return null
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value
}

export const getClientIp = (request: Request): string => {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfIp) {
    return cfIp
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const first = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .find(Boolean)

    if (first) {
      return first
    }
  }

  return "unknown"
}

const hashValue = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("")
}

const toMetadataJson = (metadata?: Record<string, unknown>): string | null => {
  if (!metadata) {
    return null
  }

  try {
    const serialized = JSON.stringify(metadata)
    return truncateText(serialized, 1800)
  } catch {
    return null
  }
}

export const logSecurityEvent = async (db: DatabaseClient, input: SecurityEventInput): Promise<void> => {
  const userAgent = truncateText(input.request.headers.get("user-agent"), 512)
  const referrer = truncateText(input.request.headers.get("referer"), 512)
  const country = truncateText(input.request.headers.get("cf-ipcountry"), 16)
  const ip = getClientIp(input.request)
  const ipHash = ip === "unknown" ? null : await hashValue(`${ip}|${userAgent ?? ""}`)

  await db.insert(securityEventsTable).values({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    eventType: truncateText(input.eventType, 120) ?? "unknown_event",
    ownerId: input.ownerId ?? null,
    linkId: input.linkId ?? null,
    slug: truncateText(input.slug ?? null, 120),
    ipHash,
    country,
    userAgent,
    referrer,
    requestPath: truncateText(new URL(input.request.url).pathname, 320),
    metadata: toMetadataJson(input.metadata),
  })
}
