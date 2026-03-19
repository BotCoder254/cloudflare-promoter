import { Activity, CheckCircle2, Link2, MousePointerClick, TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "../components/ui/badge"
import { Card } from "../components/ui/card"
import { useDashboardSummaryQuery, useHealthQuery, useVersionQuery } from "../hooks/use-platform-data"

const formatDate = (value: string) => {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const formatCompact = (value: number) => {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

export const DashboardHomePage = () => {
  const summaryQuery = useDashboardSummaryQuery()
  const versionQuery = useVersionQuery()
  const healthQuery = useHealthQuery()

  const summary = summaryQuery.data
  const trend = summary?.trend ?? []
  const latestPoint = trend[trend.length - 1]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Dashboard overview</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Real-time widgets, trend tracking, and Worker runtime health in one protected workspace.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2 border-neutral-200/80">
          <div className="flex items-center justify-between text-neutral-600">
            <span className="text-sm font-medium">Total links</span>
            <Link2 size={18} />
          </div>
          <p className="text-3xl font-bold text-neutral-900">{summary?.totals.links ?? "..."}</p>
          <p className="text-xs text-neutral-500">Across active and paused destinations</p>
        </Card>

        <Card className="space-y-2 border-neutral-200/80">
          <div className="flex items-center justify-between text-neutral-600">
            <span className="text-sm font-medium">Active links</span>
            <CheckCircle2 size={18} />
          </div>
          <p className="text-3xl font-bold text-accent">{summary?.totals.activeLinks ?? "..."}</p>
          <p className="text-xs text-neutral-500">{summary?.totals.pausedLinks ?? 0} currently paused</p>
        </Card>

        <Card className="space-y-2 border-neutral-200/80">
          <div className="flex items-center justify-between text-neutral-600">
            <span className="text-sm font-medium">Total clicks</span>
            <MousePointerClick size={18} />
          </div>
          <p className="text-3xl font-bold text-secondary">{summary ? formatCompact(summary.totals.clicks) : "..."}</p>
          <p className="text-xs text-neutral-500">{summary ? formatCompact(summary.totals.uniques) : "..."} unique visits</p>
        </Card>

        <Card className="space-y-2 border-neutral-200/80">
          <div className="flex items-center justify-between text-neutral-600">
            <span className="text-sm font-medium">Runtime</span>
            <Activity size={18} />
          </div>
          <p className="text-xl font-bold text-neutral-900">{versionQuery.data?.version ?? "..."}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="info">{versionQuery.data?.runtime ?? "cloudflare-workers"}</Badge>
            <Badge tone={healthQuery.data?.databaseConfigured ? "success" : "warning"}>
              {healthQuery.data?.databaseConfigured ? "D1 connected" : "D1 missing"}
            </Badge>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="space-y-4 border-neutral-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-poppins text-lg font-semibold text-neutral-900">Traffic trend</h2>
              <p className="text-sm text-neutral-500">Auto-refreshes every 20 seconds from protected dashboard APIs.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              Live
            </span>
          </div>

          {summaryQuery.isLoading ? <p className="text-sm text-neutral-500">Loading trend data...</p> : null}

          {trend.length ? (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} width={44} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value.toLocaleString(), name === "clicks" ? "Clicks" : "Uniques"]}
                    labelFormatter={formatDate}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#3B82F6" strokeWidth={2.4} fill="#3B82F6" fillOpacity={0.18} />
                  <Line type="monotone" dataKey="uniques" stroke="#10B981" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {!summaryQuery.isLoading && !trend.length ? (
            <p className="text-sm text-neutral-500">No trend data yet. Redirect traffic through a short link to populate charts.</p>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 border-neutral-200/80">
            <div className="flex items-center justify-between">
              <h2 className="font-poppins text-lg font-semibold text-neutral-900">Spike line</h2>
              <TrendingUp size={18} className="text-secondary" />
            </div>
            {trend.length ? (
              <>
                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <Line type="monotone" dataKey="clicks" stroke="#3B82F6" strokeWidth={2.4} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-neutral-500">
                  Latest day: {latestPoint ? `${latestPoint.clicks.toLocaleString()} clicks` : "No clicks yet"}
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-500">Waiting for traffic activity.</p>
            )}
          </Card>

          <Card className="space-y-3 border-neutral-200/80">
            <div className="flex items-center justify-between">
              <h2 className="font-poppins text-lg font-semibold text-neutral-900">Top links</h2>
              <Badge tone="info">{summary?.topLinks.length ?? 0}</Badge>
            </div>

            <div className="space-y-2">
              {summary?.topLinks.map((item) => (
                <div key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-neutral-900">{item.title}</p>
                    <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status === "active" ? "active" : "disabled"}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {item.isExpired ? <Badge tone="warning">expired</Badge> : null}
                    {item.oneTime ? <Badge tone="neutral">one-time</Badge> : null}
                    {item.isConsumed ? <Badge tone="warning">consumed</Badge> : null}
                    {item.requiresPassword ? <Badge tone="warning">protected</Badge> : null}
                    {item.isPrivate ? <Badge tone="info">private</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">/{item.slug}</p>
                  <p className="mt-1 text-xs text-neutral-600">{item.clicks.toLocaleString()} clicks</p>
                  <p className="text-xs text-neutral-500">
                    {item.lastVisitedAt ? `Last visit ${new Date(item.lastVisitedAt).toLocaleString()}` : "No visits yet"}
                  </p>
                </div>
              ))}

              {!summary?.topLinks.length ? <p className="text-sm text-neutral-500">No links yet. Create your first short link.</p> : null}
            </div>
          </Card>

          <Card className="space-y-3 border-neutral-200/80">
            <div className="flex items-center justify-between">
              <h2 className="font-poppins text-lg font-semibold text-neutral-900">Live activity</h2>
              <Badge tone="info">20s refresh</Badge>
            </div>
            <div className="space-y-2">
              {summary?.recentActivity.map((item) => (
                <div key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-neutral-900">{item.title}</p>
                    <p className="text-xs text-neutral-500">{new Date(item.visitedAt).toLocaleTimeString()}</p>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    /{item.slug} {item.country ? `- ${item.country}` : ""}
                  </p>
                </div>
              ))}
              {!summary?.recentActivity.length ? (
                <p className="text-sm text-neutral-500">No live traffic yet. New redirects appear here automatically.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
