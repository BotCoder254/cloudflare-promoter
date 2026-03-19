import { Badge } from "../components/ui/badge"
import { Card } from "../components/ui/card"
import { useLinksQuery } from "../hooks/use-links"
import { useAdminOverviewQuery } from "../hooks/use-platform-data"

export const AdminPage = () => {
  const linksQuery = useLinksQuery({ page: 1, pageSize: 100 })
  const adminOverviewQuery = useAdminOverviewQuery()

  const links = linksQuery.data?.items ?? []
  const paused = links.filter((item) => item.status === "paused")
  const active = links.filter((item) => item.status === "active")

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">Operational snapshot for protected administrative APIs.</p>
      </header>

      <Card>
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">Platform overview</h2>
        {adminOverviewQuery.isLoading ? <p className="mt-3 text-sm text-neutral-500">Loading admin metrics...</p> : null}
        {adminOverviewQuery.data ? (
          <div className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Users</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{adminOverviewQuery.data.totalUsers}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Admins</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{adminOverviewQuery.data.adminUsers}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Active sessions</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{adminOverviewQuery.data.activeSessions}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Total links</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{adminOverviewQuery.data.totalLinks}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Total visits</p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">{adminOverviewQuery.data.totalVisits}</p>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">Link moderation</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="success">{active.length} active</Badge>
          <Badge tone="warning">{paused.length} paused</Badge>
          <Badge tone="info">{links.length} total</Badge>
        </div>

        <div className="mt-4 space-y-2">
          {paused.map((item) => (
            <div key={item.id} className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-neutral-700">
              {item.title} is paused and will not resolve redirects.
            </div>
          ))}
          {!paused.length ? <p className="text-sm text-neutral-500">No paused links require action.</p> : null}
        </div>
      </Card>
    </div>
  )
}
