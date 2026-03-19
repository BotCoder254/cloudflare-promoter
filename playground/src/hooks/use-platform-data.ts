import { useQuery } from "@tanstack/react-query"

import { getAdminOverview, getAnalytics, getAuthProviders, getDashboardSummary, getHealth, getSettings, getVersion } from "../lib/api"
import { queryKeys } from "./query-keys"

export const useAnalyticsQuery = (linkId?: string) => {
  return useQuery({
    queryKey: queryKeys.analytics(linkId ?? ""),
    queryFn: () => getAnalytics(linkId ?? ""),
    enabled: Boolean(linkId),
    refetchInterval: linkId ? 10_000 : false,
  })
}

export const useDashboardSummaryQuery = () => {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: getDashboardSummary,
    refetchInterval: 15_000,
  })
}

export const useDashboardOverviewQuery = useDashboardSummaryQuery

export const useSettingsQuery = () => {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
  })
}

export const useAuthProvidersQuery = () => {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: getAuthProviders,
  })
}

export const useAdminOverviewQuery = () => {
  return useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: getAdminOverview,
    refetchInterval: 30_000,
  })
}

export const useVersionQuery = () => {
  return useQuery({
    queryKey: queryKeys.version,
    queryFn: getVersion,
  })
}

export const useHealthQuery = () => {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
  })
}
