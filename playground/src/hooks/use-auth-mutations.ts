import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  linkSocialProvider,
  login,
  logout,
  resetPassword,
  requestPasswordReset,
  signup,
  startSocialLogin,
  unlinkAuthProvider,
} from "../lib/api"
import type { ForgotPasswordInput, LoginInput, ResetPasswordInput, SignupInput, SocialProvider } from "../shared/models"
import { queryKeys } from "./query-keys"

export const useLoginMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginInput) => login(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session })
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
    },
  })
}

export const useSignupMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SignupInput) => signup(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session })
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
    },
  })
}

export const useSocialLoginMutation = () => {
  return useMutation({
    mutationFn: (provider: SocialProvider) => startSocialLogin(provider),
  })
}

export const useRequestPasswordResetMutation = () => {
  return useMutation({
    mutationFn: (payload: ForgotPasswordInput) => requestPasswordReset(payload),
  })
}

export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: (payload: ResetPasswordInput) => resetPassword(payload),
  })
}

export const useLinkProviderMutation = () => {
  return useMutation({
    mutationFn: (provider: SocialProvider) => linkSocialProvider(provider),
  })
}

type UnlinkPayload = {
  providerId: string
  accountId?: string
}

export const useUnlinkProviderMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UnlinkPayload) => unlinkAuthProvider(payload.providerId, payload.accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      void queryClient.invalidateQueries({ queryKey: queryKeys.session })
    },
  })
}

export const useLogoutMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session })
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      void queryClient.invalidateQueries({ queryKey: queryKeys.links })
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview })
    },
  })
}
