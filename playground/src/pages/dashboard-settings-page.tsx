import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { useLinkProviderMutation, useUnlinkProviderMutation } from "../hooks/use-auth-mutations"
import { useHealthQuery, useSettingsQuery, useVersionQuery } from "../hooks/use-platform-data"
import type { SocialProvider } from "../shared/models"

const providerLabels: Record<string, string> = {
  credential: "Email and password",
  github: "GitHub",
  google: "Google",
}

export const DashboardSettingsPage = () => {
  const settingsQuery = useSettingsQuery()
  const healthQuery = useHealthQuery()
  const versionQuery = useVersionQuery()
  const linkProviderMutation = useLinkProviderMutation()
  const unlinkProviderMutation = useUnlinkProviderMutation()

  const linkedProviders = settingsQuery.data?.linkedProviders ?? []
  const availableSocialProviders = settingsQuery.data?.availableSocialProviders ?? []

  const hasProvider = (providerId: string) => linkedProviders.some((provider) => provider.providerId === providerId)

  const handleLinkProvider = async (provider: SocialProvider) => {
    await linkProviderMutation.mutateAsync(provider)
  }

  const handleUnlinkProvider = async (providerId: string) => {
    const linked = linkedProviders.find((entry) => entry.providerId === providerId)
    if (!linked) {
      return
    }

    await unlinkProviderMutation.mutateAsync({
      providerId,
      accountId: linked.accountId,
    })
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Account profile, linked providers, and runtime configuration state.</p>
      </header>

      <Card>
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">Account profile</h2>
        {settingsQuery.isLoading ? <p className="mt-3 text-sm text-neutral-500">Loading profile...</p> : null}
        {settingsQuery.data ? (
          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            <p>
              <span className="font-semibold text-neutral-900">Name:</span> {settingsQuery.data.user.name}
            </p>
            <p>
              <span className="font-semibold text-neutral-900">Email:</span> {settingsQuery.data.user.email}
            </p>
            <p>
              <span className="font-semibold text-neutral-900">Role:</span> {settingsQuery.data.user.role}
            </p>
            <p>
              <span className="font-semibold text-neutral-900">Default domain:</span> {settingsQuery.data.preferences.defaultDomain}
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">Linked providers</h2>
        <div className="mt-4 space-y-3">
          {["credential", "github", "google"].map((providerId) => {
            const linked = linkedProviders.find((provider) => provider.providerId === providerId)
            const canLink = providerId !== "credential" && availableSocialProviders.includes(providerId as SocialProvider)

            return (
              <div key={providerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{providerLabels[providerId]}</p>
                  <p className="text-xs text-neutral-500">
                    {linked ? `Connected as ${linked.accountId}` : canLink ? "Not connected" : "Provider not configured"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasProvider(providerId) ? <Badge tone="success">Linked</Badge> : <Badge tone="neutral">Unlinked</Badge>}
                  {linked && providerId !== "credential" ? (
                    <Button
                      tone="neutral"
                      className="text-xs"
                      onClick={() => void handleUnlinkProvider(providerId)}
                      disabled={unlinkProviderMutation.isPending}
                    >
                      Unlink
                    </Button>
                  ) : null}
                  {!linked && canLink ? (
                    <Button
                      tone="secondary"
                      className="text-xs"
                      onClick={() => void handleLinkProvider(providerId as SocialProvider)}
                      disabled={linkProviderMutation.isPending}
                    >
                      Link
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {linkProviderMutation.error ? <p className="mt-3 text-sm text-error">{linkProviderMutation.error.message}</p> : null}
        {unlinkProviderMutation.error ? <p className="mt-3 text-sm text-error">{unlinkProviderMutation.error.message}</p> : null}
      </Card>

      <Card>
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">Runtime health</h2>
        {healthQuery.data ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="success">{healthQuery.data.status}</Badge>
            <Badge tone="info">{healthQuery.data.runtime}</Badge>
            <Badge tone={healthQuery.data.databaseConfigured ? "success" : "warning"}>
              {healthQuery.data.databaseConfigured ? "D1 connected" : "D1 missing"}
            </Badge>
            <Badge tone="neutral">{healthQuery.data.timestamp}</Badge>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">Health endpoint unavailable.</p>
        )}
      </Card>

      <Card>
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">API identity</h2>
        {versionQuery.data ? (
          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            <p>
              <span className="font-semibold text-neutral-900">App:</span> {versionQuery.data.app}
            </p>
            <p>
              <span className="font-semibold text-neutral-900">Version:</span> {versionQuery.data.version}
            </p>
            <p>
              <span className="font-semibold text-neutral-900">Runtime:</span> {versionQuery.data.runtime}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">Version endpoint unavailable.</p>
        )}
      </Card>
    </div>
  )
}
