import { z } from "zod"

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const HttpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === "http:" || protocol === "https:"
  }, "Only http and https URLs are allowed")

export const LinkStatusSchema = z.enum(["active", "paused"])
export type LinkStatus = z.infer<typeof LinkStatusSchema>

export const SocialProviderSchema = z.enum(["github", "google"])
export type SocialProvider = z.infer<typeof SocialProviderSchema>

export const AuthProviderSchema = z.enum(["credential", "github", "google"])
export type AuthProvider = z.infer<typeof AuthProviderSchema>

export const SessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(2).max(80),
  role: z.enum(["user", "admin"]),
  image: z.string().url().nullable().optional(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type SessionUser = z.infer<typeof SessionUserSchema>

export const SessionMetaSchema = z.object({
  id: z.string().min(1),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
})
export type SessionMeta = z.infer<typeof SessionMetaSchema>

export const AuthSessionResponseSchema = z.object({
  user: SessionUserSchema.nullable(),
  session: SessionMetaSchema.nullable(),
})
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>

export const SignupInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  })
export type SignupInput = z.infer<typeof SignupInputSchema>

export const LoginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().email(),
})
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>

export const ResetPasswordInputSchema = z
  .object({
    token: z.string().trim().min(1, "Reset token is required"),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  })
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>

export const AuthProvidersResponseSchema = z.object({
  socialProviders: z.array(SocialProviderSchema),
})
export type AuthProvidersResponse = z.infer<typeof AuthProvidersResponseSchema>

export const LinkedProviderSchema = z.object({
  providerId: AuthProviderSchema,
  accountId: z.string().min(1),
  scope: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
})
export type LinkedProvider = z.infer<typeof LinkedProviderSchema>

export const SettingsResponseSchema = z.object({
  user: SessionUserSchema,
  linkedProviders: z.array(LinkedProviderSchema),
  availableSocialProviders: z.array(SocialProviderSchema),
  preferences: z.object({
    timezone: z.string(),
    defaultDomain: z.string(),
    reduceMotion: z.boolean(),
  }),
})
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>

export const LinkSlugModeSchema = z.enum(["auto", "custom"])
export type LinkSlugMode = z.infer<typeof LinkSlugModeSchema>

export const LinkListFilterSchema = z.enum(["all", "active", "paused", "expired", "private", "archived"])
export type LinkListFilter = z.infer<typeof LinkListFilterSchema>

export const LinkSortBySchema = z.enum(["createdAt", "updatedAt", "clicks", "title"])
export type LinkSortBy = z.infer<typeof LinkSortBySchema>

export const SortOrderSchema = z.enum(["asc", "desc"])
export type SortOrder = z.infer<typeof SortOrderSchema>

export const BulkLinkActionSchema = z.enum(["activate", "pause", "archive"])
export type BulkLinkAction = z.infer<typeof BulkLinkActionSchema>

export const BulkLinksInputSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: BulkLinkActionSchema,
})
export type BulkLinksInput = z.infer<typeof BulkLinksInputSchema>

export const LinkRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(80),
  slug: z.string().min(3).max(40).regex(slugPattern),
  destination: HttpUrlSchema,
  description: z.string().max(240).optional(),
  status: LinkStatusSchema,
  isPrivate: z.boolean(),
  requiresPassword: z.boolean(),
  oneTime: z.boolean(),
  expiresAt: z.string().datetime().nullable().optional(),
  isExpired: z.boolean(),
  clicks: z.number().int().nonnegative(),
  uniqueClicks: z.number().int().nonnegative(),
  ownerId: z.string().min(1),
  qrCodeUrl: z.string().url().nullable().optional(),
  shortUrl: z.string().url(),
  lastVisitedAt: z.string().datetime().nullable().optional(),
  consumedAt: z.string().datetime().nullable().optional(),
  isConsumed: z.boolean(),
  archivedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type LinkRecord = z.infer<typeof LinkRecordSchema>

export const CreateLinkInputSchema = z
  .object({
    title: z.string().trim().min(2).max(80),
    destination: HttpUrlSchema,
    slugMode: LinkSlugModeSchema.default("auto"),
    slug: z.string().trim().min(3).max(40).regex(slugPattern).optional(),
    description: z.string().trim().max(240).optional(),
    isPrivate: z.boolean().default(false),
    expiresAt: z.string().datetime().optional().nullable(),
    oneTime: z.boolean().default(false),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((value) => (value.slugMode === "custom" ? Boolean(value.slug) : true), {
    message: "Custom slug is required",
    path: ["slug"],
  })
export type CreateLinkInput = z.infer<typeof CreateLinkInputSchema>

export const UpdateLinkInputSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(3).max(40).regex(slugPattern).optional(),
  destination: HttpUrlSchema.optional(),
  description: z.string().trim().max(240).optional(),
  status: LinkStatusSchema.optional(),
  isPrivate: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  oneTime: z.boolean().optional(),
  password: z.string().min(8).max(128).nullable().optional(),
  requiresPassword: z.boolean().optional(),
})
export type UpdateLinkInput = z.infer<typeof UpdateLinkInputSchema>

export const DailyStatSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clicks: z.number().int().nonnegative(),
  uniques: z.number().int().nonnegative(),
})
export type DailyStatSummary = z.infer<typeof DailyStatSummarySchema>

export const VisitActivitySchema = z.object({
  id: z.string().min(1),
  visitedAt: z.string().datetime(),
  referrer: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  isUnique: z.boolean(),
  slug: z.string().min(1),
  title: z.string().min(1),
})
export type VisitActivity = z.infer<typeof VisitActivitySchema>

export const DashboardSummaryResponseSchema = z.object({
  totals: z.object({
    links: z.number().int().nonnegative(),
    activeLinks: z.number().int().nonnegative(),
    pausedLinks: z.number().int().nonnegative(),
    privateLinks: z.number().int().nonnegative(),
    expiredLinks: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
    uniques: z.number().int().nonnegative(),
  }),
  topLinks: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      slug: z.string().min(1),
      clicks: z.number().int().nonnegative(),
      status: LinkStatusSchema,
      isExpired: z.boolean(),
      oneTime: z.boolean(),
      requiresPassword: z.boolean(),
      isPrivate: z.boolean(),
      isConsumed: z.boolean(),
      lastVisitedAt: z.string().datetime().nullable().optional(),
    }),
  ),
  trend: z.array(DailyStatSummarySchema),
  recentActivity: z.array(VisitActivitySchema),
})
export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>

export const DashboardOverviewResponseSchema = DashboardSummaryResponseSchema
export type DashboardOverviewResponse = DashboardSummaryResponse

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  app: z.string(),
  version: z.string(),
  runtime: z.string(),
  timestamp: z.string().datetime(),
  databaseConfigured: z.boolean(),
  databaseLatencyMs: z.number().nonnegative().optional(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>

export const VersionResponseSchema = z.object({
  app: z.string(),
  version: z.string(),
  runtime: z.string(),
  databaseConfigured: z.boolean(),
})
export type VersionResponse = z.infer<typeof VersionResponseSchema>

export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
})
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>

export const LinksListResponseSchema = z.object({
  items: z.array(LinkRecordSchema),
  pagination: PaginationMetaSchema,
  filters: z.object({
    status: LinkListFilterSchema,
    search: z.string().optional(),
    sortBy: LinkSortBySchema,
    sortOrder: SortOrderSchema,
  }),
})
export type LinksListResponse = z.infer<typeof LinksListResponseSchema>

export const LinkDetailResponseSchema = z.object({
  item: LinkRecordSchema,
  analyticsSummary: z.object({
    clicks: z.number().int().nonnegative(),
    uniques: z.number().int().nonnegative(),
    last7Days: z.array(DailyStatSummarySchema),
  }),
  recentVisits: z.array(VisitActivitySchema),
})
export type LinkDetailResponse = z.infer<typeof LinkDetailResponseSchema>

export const LinkResponseSchema = z.object({
  item: LinkRecordSchema,
})
export type LinkResponse = z.infer<typeof LinkResponseSchema>

export const SlugAvailabilityResponseSchema = z.object({
  slug: z.string().min(3).max(40).regex(slugPattern),
  available: z.boolean(),
  reason: z.string().optional(),
})
export type SlugAvailabilityResponse = z.infer<typeof SlugAvailabilityResponseSchema>

export const AnalyticsResponseSchema = z.object({
  linkId: z.string().min(1),
  totals: z.object({
    clicks: z.number().int().nonnegative(),
    uniques: z.number().int().nonnegative(),
  }),
  daily: z.array(DailyStatSummarySchema),
  recentVisits: z.array(VisitActivitySchema),
})
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>

export const AdminOverviewResponseSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  adminUsers: z.number().int().nonnegative(),
  activeSessions: z.number().int().nonnegative(),
  totalLinks: z.number().int().nonnegative(),
  totalVisits: z.number().int().nonnegative(),
})
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>

export const MutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
})
export type MutationResult = z.infer<typeof MutationResultSchema>

export const BulkLinksResponseSchema = MutationResultSchema.extend({
  affected: z.number().int().nonnegative(),
})
export type BulkLinksResponse = z.infer<typeof BulkLinksResponseSchema>

export const PublicUnavailableReasonSchema = z.enum(["not_found", "paused", "archived", "expired", "private", "one_time_consumed"])
export type PublicUnavailableReason = z.infer<typeof PublicUnavailableReasonSchema>

export const PublicPasswordVerifyInputSchema = z.object({
  password: z.string().min(1).max(128),
})
export type PublicPasswordVerifyInput = z.infer<typeof PublicPasswordVerifyInputSchema>

export const PublicPasswordVerifyResponseSchema = z.object({
  success: z.literal(true),
  redirectTo: z.string().min(1),
  message: z.string().optional(),
})
export type PublicPasswordVerifyResponse = z.infer<typeof PublicPasswordVerifyResponseSchema>

export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>

export const ReservedAppPrefixes = [
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "link",
  "dashboard",
  "admin",
  "api",
  "health",
  "favicon.ico",
  "favicon.svg",
  "icons.svg",
] as const
