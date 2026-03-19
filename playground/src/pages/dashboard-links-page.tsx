import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { Check, Copy, Plus, QrCode, Search, Shield, Sparkles, ToggleLeft, X } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import {
  useBulkLinksMutation,
  useCreateLinkMutation,
  useDeleteLinkMutation,
  useLinksQuery,
  useSlugAvailabilityQuery,
  useToggleLinkStatusMutation,
} from "../hooks/use-links"
import type { BulkLinkAction, LinkListFilter, LinkSortBy, SortOrder } from "../shared/models"

const filterOptions: Array<{ value: LinkListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "private", label: "Private" },
  { value: "archived", label: "Archived" },
]

const sortByOptions: Array<{ value: LinkSortBy; label: string }> = [
  { value: "updatedAt", label: "Recently updated" },
  { value: "createdAt", label: "Recently created" },
  { value: "clicks", label: "Most clicks" },
  { value: "title", label: "Title" },
]

const createSteps = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Routing" },
  { id: 3, label: "Security" },
] as const

const toIsoFromLocalInput = (value: string): string | undefined => {
  if (!value.trim()) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export const DashboardLinksPage = () => {
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [filter, setFilter] = useState<LinkListFilter>("all")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<LinkSortBy>("updatedAt")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const linksQuery = useLinksQuery({
    page,
    pageSize,
    status: filter,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
  })
  const createMutation = useCreateLinkMutation()
  const toggleStatusMutation = useToggleLinkStatusMutation()
  const deleteMutation = useDeleteLinkMutation()
  const bulkMutation = useBulkLinksMutation()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createStep, setCreateStep] = useState<(typeof createSteps)[number]["id"]>(1)

  const [title, setTitle] = useState("")
  const [slugMode, setSlugMode] = useState<"auto" | "custom">("auto")
  const [slug, setSlug] = useState("")
  const [destination, setDestination] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [oneTime, setOneTime] = useState(false)
  const [expiresAtLocal, setExpiresAtLocal] = useState("")
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [debouncedSlug, setDebouncedSlug] = useState("")
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSlug(slug.trim().toLowerCase())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [slug])

  useEffect(() => {
    if (!isCreateModalOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCreateModalOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isCreateModalOpen])

  const slugQuery = useSlugAvailabilityQuery(slugMode === "custom" ? debouncedSlug : "")
  const normalizedSlug = slug.trim().toLowerCase()
  const customSlugInvalid = slugMode === "custom" && normalizedSlug.length > 0 && slugQuery.data?.available === false

  const shortUrlPreview =
    slugMode === "custom" && slugQuery.data?.available && normalizedSlug ? `${window.location.origin}/${normalizedSlug}` : undefined

  const disableCreate = useMemo(() => {
    if (createMutation.isPending) {
      return true
    }

    if (title.trim().length < 2 || !isValidHttpUrl(destination)) {
      return true
    }

    if (slugMode === "custom" && (!normalizedSlug || customSlugInvalid || slugQuery.isFetching)) {
      return true
    }

    if (requiresPassword && password.trim().length < 8) {
      return true
    }

    return false
  }, [createMutation.isPending, customSlugInvalid, destination, normalizedSlug, password, requiresPassword, slugMode, slugQuery.isFetching, title])

  const canAdvanceStep = useMemo(() => {
    if (createStep === 1) {
      return title.trim().length >= 2 && isValidHttpUrl(destination)
    }

    if (createStep === 2) {
      if (slugMode === "auto") {
        return true
      }

      return Boolean(normalizedSlug) && !customSlugInvalid && !slugQuery.isFetching
    }

    return true
  }, [createStep, customSlugInvalid, destination, normalizedSlug, slugMode, slugQuery.isFetching, title])

  const resetCreateForm = () => {
    setTitle("")
    setSlug("")
    setDestination("")
    setDescription("")
    setIsPrivate(false)
    setOneTime(false)
    setExpiresAtLocal("")
    setRequiresPassword(false)
    setPassword("")
    setSlugMode("auto")
    setCreateStep(1)
  }

  const openCreateModal = () => {
    setIsCreateModalOpen(true)
    setCreateStep(1)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setCreateStep(1)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const created = await createMutation.mutateAsync({
      title,
      destination,
      slugMode,
      slug: slugMode === "custom" ? normalizedSlug : undefined,
      description: description || undefined,
      isPrivate,
      oneTime,
      expiresAt: toIsoFromLocalInput(expiresAtLocal),
      password: requiresPassword ? password : undefined,
    })

    setIsCreateModalOpen(false)
    resetCreateForm()
    navigate(`/dashboard/links/${created.item.id}`)
  }

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id)
    setSelectedIds((current) => current.filter((entry) => entry !== id))
  }

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkId(id)
      window.setTimeout(() => setCopiedLinkId((current) => (current === id ? null : current)), 1200)
    } catch {
      setCopiedLinkId(null)
    }
  }

  const items = linksQuery.data?.items ?? []
  const pagination = linksQuery.data?.pagination
  const visibleIds = items.map((item) => item.id)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))
  const selectedVisibleCount = visibleIds.filter((id) => selectedSet.has(id)).length

  const toggleSelectedItem = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return [...new Set([...current, id])]
      }

      return current.filter((entry) => entry !== id)
    })
  }

  const toggleSelectVisible = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id))
      }

      return [...new Set([...current, ...visibleIds])]
    })
  }

  const runBulkAction = async (action: BulkLinkAction) => {
    if (!selectedIds.length || bulkMutation.isPending) {
      return
    }

    await bulkMutation.mutateAsync({
      action,
      ids: selectedIds,
    })

    setSelectedIds([])
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Links</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Create, filter, and manage short links with ownership-safe controls and real-time status updates.
          </p>
        </div>

        <Button className="gap-2" onClick={openCreateModal}>
          <Plus size={16} />
          Create link
        </Button>
      </header>

      <Card className="border-neutral-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-poppins text-lg font-semibold text-neutral-900">Create link</h2>
            <p className="mt-1 text-sm text-neutral-500">Open the guided modal to configure slug, controls, security, and QR preview.</p>
          </div>

          <Button tone="secondary" className="gap-2" onClick={openCreateModal}>
            <Plus size={16} />
            Open create wizard
          </Button>
        </div>
      </Card>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close create link modal" className="absolute inset-0 bg-neutral-900/50" onClick={closeCreateModal} />

          <div className="relative z-10 flex h-full items-center justify-center px-4 py-6">
            <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border-neutral-200 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-poppins text-xl font-semibold text-neutral-900">Create short link</h2>
                  <p className="mt-1 text-sm text-neutral-500">Step-by-step setup with the same fields and controls from the links workspace.</p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100"
                  aria-label="Close create modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {createSteps.map((step) => {
                  const isDone = createStep > step.id
                  const isCurrent = createStep === step.id

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        isCurrent
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : isDone
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-neutral-200 bg-neutral-50 text-neutral-500"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isCurrent
                            ? "bg-secondary text-white"
                            : isDone
                              ? "bg-success text-white"
                              : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {isDone ? <Check size={14} /> : step.id}
                      </span>
                      <span className="font-medium">{step.label}</span>
                    </div>
                  )
                })}
              </div>

              <form className="mt-5 grid gap-4" onSubmit={handleCreate}>
                {createStep === 1 ? (
                  <>
                    <div>
                      <label htmlFor="create-title" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Title
                      </label>
                      <Input
                        id="create-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Release promotion docs"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="create-destination" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Destination URL
                      </label>
                      <Input
                        id="create-destination"
                        type="url"
                        value={destination}
                        onChange={(event) => setDestination(event.target.value)}
                        placeholder="https://developers.cloudflare.com"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="create-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Description
                      </label>
                      <Textarea
                        id="create-description"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Context for teammates"
                      />
                    </div>
                  </>
                ) : null}

                {createStep === 2 ? (
                  <>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Slug mode</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSlugMode("auto")}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                            slugMode === "auto" ? "border-secondary bg-secondary text-white" : "border-neutral-300 bg-white text-neutral-700"
                          }`}
                        >
                          Auto slug
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlugMode("custom")}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                            slugMode === "custom" ? "border-secondary bg-secondary text-white" : "border-neutral-300 bg-white text-neutral-700"
                          }`}
                        >
                          Custom slug
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="create-slug" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Custom slug
                      </label>
                      <Input
                        id="create-slug"
                        value={slug}
                        onChange={(event) => setSlug(event.target.value.replace(/\s+/g, "-").toLowerCase())}
                        placeholder="release-v21"
                        disabled={slugMode !== "custom"}
                        required={slugMode === "custom"}
                      />

                      {slugMode === "custom" && debouncedSlug.length >= 3 ? (
                        <p className={`mt-1 text-xs ${slugQuery.data?.available ? "text-success" : "text-error"}`}>
                          {slugQuery.isFetching ? "Checking..." : slugQuery.data?.available ? "Slug is available" : slugQuery.data?.reason ?? "Unavailable"}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={isPrivate}
                          onChange={(event) => setIsPrivate(event.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 text-secondary"
                        />
                        <Shield size={16} />
                        Private link
                      </label>

                      <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={oneTime}
                          onChange={(event) => setOneTime(event.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 text-secondary"
                        />
                        <Sparkles size={16} />
                        One-time redirect
                      </label>
                    </div>

                    <div>
                      <label htmlFor="create-expires" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Expiration (optional)
                      </label>
                      <Input id="create-expires" type="datetime-local" value={expiresAtLocal} onChange={(event) => setExpiresAtLocal(event.target.value)} />
                    </div>
                  </>
                ) : null}

                {createStep === 3 ? (
                  <>
                    <div>
                      <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        <input
                          type="checkbox"
                          checked={requiresPassword}
                          onChange={(event) => setRequiresPassword(event.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 text-secondary"
                        />
                        Password protection
                      </label>

                      <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Minimum 8 characters"
                        disabled={!requiresPassword}
                        minLength={8}
                      />
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">QR preview</p>
                          <p className="text-xs text-neutral-500">
                            {shortUrlPreview
                              ? shortUrlPreview
                              : "Choose custom slug for pre-save QR preview or create link to view final QR"}
                          </p>
                        </div>

                        {shortUrlPreview ? (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(shortUrlPreview)}`}
                            alt="QR preview"
                            className="h-16 w-16 rounded-lg border border-neutral-200 bg-white p-1"
                          />
                        ) : (
                          <QrCode className="text-neutral-400" size={32} />
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-600">
                      <p className="font-semibold text-neutral-900">Review</p>
                      <p className="mt-1">Title: {title || "-"}</p>
                      <p>Destination: {destination || "-"}</p>
                      <p>Slug mode: {slugMode === "custom" ? `Custom (${normalizedSlug || "pending"})` : "Auto"}</p>
                      <p>
                        Controls: {isPrivate ? "Private" : "Public"}, {oneTime ? "One-time" : "Reusable"}, {requiresPassword ? "Password" : "No password"}
                      </p>
                    </div>
                  </>
                ) : null}

                {createMutation.error ? <p className="text-sm text-error">{createMutation.error.message}</p> : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3">
                  <Button
                    tone="neutral"
                    onClick={
                      createStep === 1
                        ? closeCreateModal
                        : () => setCreateStep((value) => (value === 3 ? 2 : 1))
                    }
                  >
                    {createStep === 1 ? "Cancel" : "Back"}
                  </Button>

                  {createStep < createSteps.length ? (
                    <Button tone="secondary" onClick={() => setCreateStep((value) => (value === 1 ? 2 : 3))} disabled={!canAdvanceStep}>
                      Next
                    </Button>
                  ) : (
                    <Button type="submit" disabled={disableCreate}>
                      {createMutation.isPending ? "Creating..." : "Create short link"}
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </div>
        </div>
      ) : null}

      <Card className="border-neutral-200/80">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-poppins text-lg font-semibold text-neutral-900">Managed links</h2>
            <p className="text-sm text-neutral-500">Filter, sort, and run link workflows without leaving this screen.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSelectedIds([])
                  setPage(1)
                }}
                className="pl-9"
                placeholder="Search links"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as LinkListFilter)
                setSelectedIds([])
                setPage(1)
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as LinkSortBy)
                setSelectedIds([])
                setPage(1)
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
              {sortByOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as SortOrder)
                setSelectedIds([])
                setPage(1)
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectVisible}
                className="h-4 w-4 rounded border-neutral-300 text-secondary"
                disabled={!visibleIds.length}
              />
              Select visible links
            </label>

            <p className="text-xs text-neutral-500">
              Selected {selectedIds.length} total{selectedVisibleCount ? ` (${selectedVisibleCount} on this page)` : ""}
            </p>
          </div>

          {selectedIds.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
              <Button tone="secondary" className="text-xs" onClick={() => void runBulkAction("activate")} disabled={bulkMutation.isPending}>
                Activate selected
              </Button>
              <Button tone="neutral" className="text-xs" onClick={() => void runBulkAction("pause")} disabled={bulkMutation.isPending}>
                Pause selected
              </Button>
              <Button tone="danger" className="text-xs" onClick={() => void runBulkAction("archive")} disabled={bulkMutation.isPending}>
                Archive selected
              </Button>

              {bulkMutation.error ? <p className="text-xs text-error">{bulkMutation.error.message}</p> : null}
              {bulkMutation.data ? <p className="text-xs text-success">Updated {bulkMutation.data.affected} links</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {linksQuery.isLoading ? <p className="text-sm text-neutral-500">Loading links...</p> : null}

          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.id)}
                    onChange={(event) => toggleSelectedItem(item.id, event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-neutral-300 text-secondary"
                  />

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900">{item.title}</p>
                    <p className="text-xs text-neutral-500">{item.shortUrl}</p>
                    <p className="mt-1 truncate text-sm text-neutral-600">{item.destination}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status === "active" ? "active" : "disabled"}</Badge>
                  {item.isExpired ? <Badge tone="warning">expired</Badge> : null}
                  {item.isPrivate ? <Badge tone="info">private</Badge> : null}
                  {item.oneTime ? <Badge tone="neutral">one-time</Badge> : null}
                  {item.isConsumed ? <Badge tone="warning">consumed</Badge> : null}
                  {item.requiresPassword ? <Badge tone="warning">password</Badge> : null}
                  <Badge tone="info">{item.clicks} clicks</Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button tone="neutral" className="gap-2 text-xs" onClick={() => void handleCopy(item.id, item.shortUrl)}>
                  <Copy size={14} />
                  {copiedLinkId === item.id ? "Copied" : "Copy URL"}
                </Button>

                <Button
                  tone="neutral"
                  className="gap-2 text-xs"
                  onClick={() => void toggleStatusMutation.mutateAsync(item.id)}
                  disabled={toggleStatusMutation.isPending}
                >
                  <ToggleLeft size={14} />
                  Toggle status
                </Button>

                <Link
                  to={`/dashboard/links/${item.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2f76df]"
                >
                  Open detail
                </Link>

                <Link
                  to={`/dashboard/analytics?linkId=${item.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
                >
                  View analytics
                </Link>

                <a
                  href={item.qrCodeUrl ?? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(item.shortUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
                >
                  QR
                </a>

                <Button tone="danger" className="text-xs" onClick={() => void handleDelete(item.id)} disabled={deleteMutation.isPending}>
                  Archive
                </Button>
              </div>
            </div>
          ))}

          {!linksQuery.isLoading && !items.length ? <p className="text-sm text-neutral-500">No links match this filter yet.</p> : null}
        </div>

        {pagination ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
            <p>
              Page {pagination.page} of {pagination.totalPages} - {pagination.total} links
            </p>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setSelectedIds([])
                  setPage(1)
                }}
                className="rounded-xl border border-neutral-300 bg-white px-2 py-1 text-xs"
              >
                <option value={8}>8 / page</option>
                <option value={12}>12 / page</option>
                <option value={20}>20 / page</option>
              </select>

              <Button
                tone="neutral"
                className="text-xs"
                onClick={() => {
                  setSelectedIds([])
                  setPage((value) => Math.max(1, value - 1))
                }}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                tone="neutral"
                className="text-xs"
                onClick={() => {
                  setSelectedIds([])
                  setPage((value) => Math.min(pagination.totalPages, value + 1))
                }}
                disabled={page >= pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
