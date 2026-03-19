export const queryKeys = {
  session: ["session"] as const,
  providers: ["providers"] as const,
  settings: ["settings"] as const,
  dashboardSummary: ["dashboard-summary"] as const,
  dashboardOverview: ["dashboard-summary"] as const,
  adminOverview: ["admin-overview"] as const,
  version: ["version"] as const,
  health: ["health"] as const,
  links: ["links"] as const,
  link: (id: string) => ["links", id] as const,
  slugCheck: (slug: string) => ["slug-check", slug] as const,
  analytics: (linkId: string) => ["analytics", linkId] as const,
}
