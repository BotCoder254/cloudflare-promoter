import type { FormEvent } from "react"
import { useState } from "react"
import { Copy, QrCode } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useNavigate, useParams } from "react-router-dom"

import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import { useLinkDetailQuery, useUpdateLinkMutation } from "../hooks/use-links"
import type { LinkRecord } from "../shared/models"

type LinkDetailFormProps = {
  item: LinkRecord
  isPending: boolean
  errorMessage?: string
  onSave: (values: {
    title: string
    slug: string
    destination: string
    description?: string
    status: "active" | "paused"
    isPrivate: boolean
    oneTime: boolean
    expiresAt?: string | null
    requiresPassword: boolean
    password?: string | null
  }) => Promise<unknown>
}

const toLocalDateTimeInput = (iso?: string | null): string => {
  if (!iso) {
    return ""
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

const LinkDetailForm = ({ item, isPending, errorMessage, onSave }: LinkDetailFormProps) => {
  const [title, setTitle] = useState(item.title)
  const [slug, setSlug] = useState(item.slug)
  const [destination, setDestination] = useState(item.destination)
  const [description, setDescription] = useState(item.description ?? "")
  const [status, setStatus] = useState<"active" | "paused">(item.status)
  const [isPrivate, setIsPrivate] = useState(item.isPrivate)
  const [oneTime, setOneTime] = useState(item.oneTime)
  const [expiresAt, setExpiresAt] = useState(toLocalDateTimeInput(item.expiresAt))
  const [requiresPassword, setRequiresPassword] = useState(item.requiresPassword)
  const [password, setPassword] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await onSave({
      title,
      slug,
      destination,
      description: description || undefined,
      status,
      isPrivate,
      oneTime,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      requiresPassword,
      password: requiresPassword ? (password.trim() ? password : undefined) : null,
    })
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="detail-title" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Title
          </label>
          <Input id="detail-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>

        <div>
          <label htmlFor="detail-slug" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Slug
          </label>
          <Input id="detail-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} required />
        </div>
      </div>

      <div>
        <label htmlFor="detail-destination" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Destination URL
        </label>
        <Input id="detail-destination" type="url" value={destination} onChange={(event) => setDestination(event.target.value)} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="detail-status" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Status
          </label>
          <select
            id="detail-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "active" | "paused")}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </div>

        <div>
          <label htmlFor="detail-expires" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Expires at
          </label>
          <Input id="detail-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-secondary"
          />
          Private link
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={oneTime}
            onChange={(event) => setOneTime(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-secondary"
          />
          One-time redirect
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={requiresPassword}
            onChange={(event) => setRequiresPassword(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-secondary"
          />
          Require password
        </label>

        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Set new password (optional)"
          minLength={8}
          disabled={!requiresPassword}
        />
      </div>

      <div>
        <label htmlFor="detail-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Description
        </label>
        <Textarea id="detail-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>

      {errorMessage ? <p className="text-sm text-error">{errorMessage}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

export const DashboardLinkDetailPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const detailQuery = useLinkDetailQuery(id)
  const updateMutation = useUpdateLinkMutation()
  const [copied, setCopied] = useState(false)

  if (!id) {
    return <p className="text-sm text-error">Link id is missing</p>
  }

  if (detailQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Loading link detail...</p>
  }

  if (!detailQuery.data?.item) {
    return (
      <Card>
        <p className="text-sm text-error">The requested link was not found.</p>
      </Card>
    )
  }

  const item = detailQuery.data.item
  const dailyTrend = detailQuery.data.analyticsSummary.last7Days
  const recentVisits = detailQuery.data.recentVisits

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.shortUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const analyticsDelta = (() => {
    if (!dailyTrend.length) {
      return "No recent activity"
    }

    const latest = dailyTrend[dailyTrend.length - 1]?.clicks ?? 0
    const previous = dailyTrend[dailyTrend.length - 2]?.clicks ?? 0

    if (latest === previous) {
      return "Stable vs previous day"
    }

    const diff = latest - previous
    return diff > 0 ? `+${diff} clicks vs previous day` : `${diff} clicks vs previous day`
  })()

  const trendData = dailyTrend.map((entry) => ({
    ...entry,
    label: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }))

  const last7DayClicks = dailyTrend.reduce((total, entry) => total + entry.clicks, 0)
  const last7DayUniques = dailyTrend.reduce((total, entry) => total + entry.uniques, 0)

  const countryBreakdown = Object.entries(
    recentVisits.reduce<Record<string, number>>((accumulator, visit) => {
      const key = (visit.country ?? "Unknown").toUpperCase()
      accumulator[key] = (accumulator[key] ?? 0) + 1
      return accumulator
    }, {}),
  )
    .map(([country, visits]) => ({ country, visits }))
    .sort((left, right) => right.visits - left.visits)
    .slice(0, 5)

  const referrerBreakdown = Object.entries(
    recentVisits.reduce<Record<string, number>>((accumulator, visit) => {
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
    .slice(0, 5)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Link detail</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage destination, controls, QR access, and link-level analytics.</p>
        </div>
        <Button tone="neutral" onClick={() => navigate("/dashboard/links")}>Back to links</Button>
      </header>

      <Card className="space-y-4 border-neutral-200/80">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status === "active" ? "active" : "disabled"}</Badge>
          {item.isPrivate ? <Badge tone="info">private</Badge> : null}
          {item.oneTime ? <Badge tone="neutral">one-time</Badge> : null}
          {item.isConsumed ? <Badge tone="warning">consumed</Badge> : null}
          {item.requiresPassword ? <Badge tone="warning">password protected</Badge> : null}
          {item.isExpired ? <Badge tone="warning">expired</Badge> : null}
          <Badge tone="info">{item.clicks} clicks</Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Short URL</p>
            <p className="text-sm font-semibold text-neutral-900">{item.shortUrl}</p>
            <p className="mt-1 text-xs text-neutral-500">Destination: {item.destination}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="neutral" className="gap-2" onClick={() => void handleCopy()}>
              <Copy size={15} />
              {copied ? "Copied" : "Copy URL"}
            </Button>
            <a
              href={item.qrCodeUrl ?? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(item.shortUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
            >
              <QrCode size={16} />
              Open QR
            </a>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-neutral-200/80">
        <div className="flex items-center justify-between">
          <h2 className="font-poppins text-lg font-semibold text-neutral-900">Analytics pulse</h2>
          <Badge tone="info">{analyticsDelta}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Total clicks</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{detailQuery.data.analyticsSummary.clicks.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Unique visitors</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{detailQuery.data.analyticsSummary.uniques.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Last 7 days clicks</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{last7DayClicks.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Last 7 days uniques</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{last7DayUniques.toLocaleString()}</p>
          </div>
        </div>

        {dailyTrend.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-56 w-full rounded-xl border border-neutral-200 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="clickFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="clicks" stroke="#3B82F6" fill="url(#clickFill)" strokeWidth={2.2} />
                  <Line type="monotone" dataKey="uniques" stroke="#0F766E" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="h-56 w-full rounded-xl border border-neutral-200 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="uniques" fill="#0F766E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No trend data yet for this link.</p>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Top countries</p>
            <div className="mt-2 space-y-2">
              {countryBreakdown.map((entry) => (
                <div key={entry.country} className="flex items-center justify-between text-sm text-neutral-700">
                  <span>{entry.country}</span>
                  <span className="font-semibold text-neutral-900">{entry.visits}</span>
                </div>
              ))}
              {!countryBreakdown.length ? <p className="text-sm text-neutral-500">No country data yet.</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Top referrers</p>
            <div className="mt-2 space-y-2">
              {referrerBreakdown.map((entry) => (
                <div key={entry.source} className="flex items-center justify-between gap-3 text-sm text-neutral-700">
                  <span className="truncate">{entry.source}</span>
                  <span className="font-semibold text-neutral-900">{entry.visits}</span>
                </div>
              ))}
              {!referrerBreakdown.length ? <p className="text-sm text-neutral-500">No referrer data yet.</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {recentVisits.map((visit) => (
            <div key={visit.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                <span>{new Date(visit.visitedAt).toLocaleString()}</span>
                <span>{visit.country ?? "Unknown country"}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-600">{visit.referrer || "Direct traffic"}</p>
            </div>
          ))}
          {!recentVisits.length ? <p className="text-sm text-neutral-500">No recent visit events yet.</p> : null}
        </div>
      </Card>

      <Card className="space-y-4 border-neutral-200/80">
        <h2 className="font-poppins text-lg font-semibold text-neutral-900">Edit link settings</h2>
        <LinkDetailForm
          key={item.updatedAt}
          item={item}
          isPending={updateMutation.isPending}
          errorMessage={updateMutation.error?.message}
          onSave={(values) =>
            updateMutation.mutateAsync({
              id,
              values,
            })
          }
        />
      </Card>
    </div>
  )
}
