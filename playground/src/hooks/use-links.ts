import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  bulkUpdateLinks,
  checkSlugAvailability,
  createLinkRecord,
  deleteLinkRecord,
  getLink,
  getLinks,
  toggleLinkStatus,
  updateLinkRecord,
  verifyPublicLinkPassword,
} from "../lib/api"
import type { BulkLinkAction, CreateLinkInput, LinkListFilter, LinkSortBy, SortOrder, UpdateLinkInput } from "../shared/models"
import { queryKeys } from "./query-keys"

type UseLinksQueryOptions = {
  page?: number
  pageSize?: number
  status?: LinkListFilter
  search?: string
  sortBy?: LinkSortBy
  sortOrder?: SortOrder
}

export const useLinksQuery = (options: UseLinksQueryOptions = {}) => {
  return useQuery({
    queryKey: [
      ...queryKeys.links,
      options.page ?? 1,
      options.pageSize ?? 10,
      options.status ?? "all",
      options.search ?? "",
      options.sortBy ?? "updatedAt",
      options.sortOrder ?? "desc",
    ],
    queryFn: () => getLinks(options),
    refetchInterval: 20_000,
  })
}

export const useLinkDetailQuery = (id?: string) => {
  return useQuery({
    queryKey: queryKeys.link(id ?? ""),
    queryFn: () => getLink(id ?? ""),
    enabled: Boolean(id),
  })
}

export const useSlugAvailabilityQuery = (slug: string) => {
  const normalized = slug.trim().toLowerCase()

  return useQuery({
    queryKey: queryKeys.slugCheck(normalized),
    queryFn: () => checkSlugAvailability(normalized),
    enabled: normalized.length >= 3,
  })
}

export const useCreateLinkMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateLinkInput) => createLinkRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  })
}

type UpdatePayload = {
  id: string
  values: UpdateLinkInput
}

export const useUpdateLinkMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, values }: UpdatePayload) => updateLinkRecord(id, values),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
      void queryClient.invalidateQueries({ queryKey: queryKeys.link(variables.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics(variables.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  })
}

export const useToggleLinkStatusMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => toggleLinkStatus(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
      void queryClient.invalidateQueries({ queryKey: queryKeys.link(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  })
}

export const useDeleteLinkMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteLinkRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  })
}

type BulkActionPayload = {
  ids: string[]
  action: BulkLinkAction
}

export const useBulkLinksMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BulkActionPayload) => bulkUpdateLinks(payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })

      for (const id of variables.ids) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.link(id) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics(id) })
      }
    },
  })
}

type VerifyPasswordPayload = {
  slug: string
  password: string
}

export const useVerifyPublicLinkPasswordMutation = () => {
  return useMutation({
    mutationFn: (payload: VerifyPasswordPayload) => verifyPublicLinkPassword(payload.slug, { password: payload.password }),
  })
}
