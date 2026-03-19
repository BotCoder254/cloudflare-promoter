import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Activity, Clock3, LineChart as LineChartIcon, MousePointerClick, TrendingUp, Users } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "../components/ui/badge"
import { Card } from "../components/ui/card"
import { useLinksQuery } from "../hooks/use-links"
import { useAnalyticsQuery, useDashboardSummaryQuery } from "../hooks/use-platform-data"

const formatDate = (value: string) => {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const formatCompact = (value: number) => {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

export const DashboardAnalyticsPage = () => {
  const [searchParams] = useSearchParams()
  const linksQuery = useLinksQuery({ page: 1, pageSize: 100, sortBy: "clicks", sortOrder: "desc" })
  const summaryQuery = useDashboardSummaryQuery()

  const preferredLinkId = searchParams.get("linkId") ?? undefined
  const [manualSelectedLinkId, setManualSelectedLinkId] = useState<string | undefined>(preferredLinkId)

  const selectedLinkId = manualSelectedLinkId ?? preferredLinkId ?? linksQuery.data?.items[0]?.id
  const selectedLink = linksQuery.data?.items.find((item) => item.id === selectedLinkId)
  const analyticsQuery = useAnalyticsQuery(selectedLinkId)
  const daily = analyticsQuery.data?.daily
  const recentVisits = analyticsQuery.data?.recentVisits

  const trendData = useMemo(
    () =>
      (daily ?? []).map((point) => ({
        ...point,
        label: formatDate(point.date),
      })),
    [daily],
  )

  const latestPoint = trendData[trendData.length - 1]
  const previousPoint = trendData[trendData.length - 2]
  const dailyDelta = latestPoint && previousPoint ? latestPoint.clicks - previousPoint.clicks : 0

  const averageDailyClicks = trendData.length ? Math.round((analyticsQuery.data?.totals.clicks ?? 0) / trendData.length) : 0

  const uniqueVsRepeat = useMemo(() => {
    const clicks = analyticsQuery.data?.totals.clicks ?? 0
    const uniques = analyticsQuery.data?.totals.uniques ?? 0
    const repeat = Math.max(0, clicks - uniques)

    return [
      { name: "Unique", value: uniques, color: "#10B981" },
      { name: "Repeat", value: repeat, color: "#3B82F6" },
    ]
  }, [analyticsQuery.data?.totals.clicks, analyticsQuery.data?.totals.uniques])

  const countryBreakdown = useMemo(
    () =>
      Object.entries(
        (recentVisits ?? []).reduce<Record<string, number>>((accumulator, visit) => {
          const key = (visit.country ?? "Unknown").toUpperCase()
          accumulator[key] = (accumulator[key] ?? 0) + 1
          return accumulator
        }, {}),
      )
        .map(([country, visits]) => ({ country, visits }))
        .sort((left, right) => right.visits - left.visits)
        .slice(0, 5),
    [recentVisits],
  )

  const topReferrers = useMemo(
    () =>
      Object.entries(
        (recentVisits ?? []).reduce<Record<string, number>>((accumulator, visit) => {
          const raw = visit.referrer?.trim() || "Direct"
          if (raw === "Direct") {
            accumulator.Direct = (accumulator.Direct ?? 0) + 1
            return accumulator
          }

          try {
            const host = new URL(raw).hostname.replace(/^www\./, "")
            accumulator[host] = (accumulator[host] ?? 0) + 1
          } catch {
            accumulator[raw] = (accumulator[raw] ?? 0) + 1
          }

          return accumulator
        }, {}),
      )
        .map(([source, visits]) => ({ source, visits }))
        .sort((left, right) => right.visits - left.visits)
        .slice(0, 5),
    [recentVisits],
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Review real-time daily click activity and unique visitor trends for each short link.
        </p>
      </header>

      <Card className="border-neutral-200/80">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label htmlFor="analytics-link" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Link
            </label>
            <select
              id="analytics-link"
              value={selectedLinkId ?? ""}
              onChange={(event) => setManualSelectedLinkId(event.target.value || undefined)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
            >
              <option value="">Select a link</option>
              {linksQuery.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} (/{item.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="info">15s refresh</Badge>
            <Badge tone={selectedLink?.status === "active" ? "success" : "warning"}>{selectedLink?.status === "active" ? "active" : "disabled"}</Badge>
            {selectedLink?.isExpired ? <Badge tone="warning">expired</Badge> : null}
            {selectedLink?.oneTime ? <Badge tone="neutral">one-time</Badge> : null}
            {selectedLink?.requiresPassword ? <Badge tone="warning">protected</Badge> : null}
          </div>
        </div>
      </Card>

      {analyticsQuery.isLoading ? <p className="text-sm text-neutral-500">Loading analytics...</p> : null}

      {analyticsQuery.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total clicks",
                value: analyticsQuery.data.totals.clicks.toLocaleString(),
                icon: MousePointerClick,
                tone: "text-secondary",
              },
              {
                label: "Unique visitors",
                value: analyticsQuery.data.totals.uniques.toLocaleString(),
                icon: Users,
                tone: "text-success",
              },
              {
                label: "Tracked days",
                value: trendData.length.toLocaleString(),
                icon: Activity,
                tone: "text-info",
              },
              {
                label: "Avg clicks / day",
                value: averageDailyClicks.toLocaleString(),
                icon: LineChartIcon,
                tone: "text-neutral-700",
              },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
              >
                <Card className="border-neutral-200/80 p-4">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span className="text-xs uppercase tracking-wide">{item.label}</span>
                    <item.icon size={16} className={item.tone} />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">{item.value}</p>
                </Card>
              </motion.div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <Card className="space-y-4 border-neutral-200/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-poppins text-lg font-semibold text-neutral-900">Daily click velocity</h2>
                    <p className="text-sm text-neutral-500">Combined click and unique trend with live auto-refresh.</p>
                  </div>
                  <Badge tone={dailyDelta >= 0 ? "success" : "warning"}>
                    {previousPoint ? `${dailyDelta >= 0 ? "+" : ""}${dailyDelta.toLocaleString()} vs prev day` : "No comparison yet"}
                  </Badge>
                </div>

                <div className="h-[300px] w-full sm:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 10, right: 14, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="analyticsClickFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 12 }} tickMargin={8} />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} width={44} />
                      <Tooltip
                        formatter={(value: number, name: string) => [value.toLocaleString(), name === "clicks" ? "Clicks" : "Uniques"]}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                      />
                      <Area dataKey="clicks" type="monotone" fill="url(#analyticsClickFill)" stroke="#3B82F6" strokeWidth={2.4} />
                      <Bar dataKey="clicks" fill="#3B82F6" fillOpacity={0.2} maxBarSize={20} radius={[8, 8, 0, 0]} />
                      <Line dataKey="uniques" type="monotone" stroke="#10B981" strokeWidth={2.2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.04 }}
              className="space-y-4"
            >
              <Card className="space-y-3 border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <h2 className="font-poppins text-sm font-semibold text-neutral-900">Audience mix</h2>
                  <Badge tone="info">Live ratio</Badge>
                </div>

                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={uniqueVsRepeat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2}>
                        {uniqueVsRepeat.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {uniqueVsRepeat.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm text-neutral-700">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}</span>
                      </div>
                      <span className="font-semibold text-neutral-900">{entry.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <h2 className="font-poppins text-sm font-semibold text-neutral-900">Top countries</h2>
                  <TrendingUp size={16} className="text-secondary" />
                </div>

                <div className="space-y-2">
                  {countryBreakdown.map((entry) => (
                    <div key={entry.country} className="flex items-center justify-between text-sm text-neutral-700">
                      <span>{entry.country}</span>
                      <span className="font-semibold text-neutral-900">{entry.visits}</span>
                    </div>
                  ))}
                  {!countryBreakdown.length ? <p className="text-sm text-neutral-500">No country data yet.</p> : null}
                </div>
              </Card>
            </motion.div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}>
              <Card className="space-y-3 border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <h2 className="font-poppins text-lg font-semibold text-neutral-900">Recent visits</h2>
                  <Badge tone="info">Realtime feed</Badge>
                </div>

                <div className="space-y-2">
                  {(recentVisits ?? []).map((visit) => (
                    <div key={visit.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                        <span className="truncate font-semibold text-neutral-700">{visit.title}</span>
                        <span>{new Date(visit.visitedAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        /{visit.slug} {visit.country ? `- ${visit.country}` : ""}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{visit.referrer || "Direct traffic"}</p>
                    </div>
                  ))}
                  {!recentVisits?.length ? <p className="text-sm text-neutral-500">No recent visits captured for this link yet.</p> : null}
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.12 }}
              className="space-y-4"
            >
              <Card className="space-y-3 border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <h2 className="font-poppins text-sm font-semibold text-neutral-900">Top-performing links</h2>
                  <Badge tone="info">{summaryQuery.data?.topLinks.length ?? 0}</Badge>
                </div>

                <div className="space-y-2">
                  {summaryQuery.data?.topLinks.map((item) => (
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
                      <p className="text-xs text-neutral-600">{formatCompact(item.clicks)} clicks</p>
                    </div>
                  ))}
                  {!summaryQuery.data?.topLinks.length ? <p className="text-sm text-neutral-500">No top links yet.</p> : null}
                </div>
              </Card>

              <Card className="space-y-3 border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <h2 className="font-poppins text-sm font-semibold text-neutral-900">Top referrers</h2>
                  <Clock3 size={16} className="text-neutral-500" />
                </div>

                <div className="space-y-2">
                  {topReferrers.map((entry) => (
                    <div key={entry.source} className="flex items-center justify-between gap-2 text-sm text-neutral-700">
                      <span className="truncate">{entry.source}</span>
                      <span className="font-semibold text-neutral-900">{entry.visits}</span>
                    </div>
                  ))}
                  {!topReferrers.length ? <p className="text-sm text-neutral-500">No referrer data yet.</p> : null}
                </div>
              </Card>
            </motion.div>
          </section>
        </>
      ) : null}

      {!analyticsQuery.isLoading && !analyticsQuery.data ? <p className="text-sm text-neutral-500">Select a link to load analytics.</p> : null}
    </div>
  )
}
