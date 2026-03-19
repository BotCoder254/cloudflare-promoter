import { AlertCircle } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router-dom"

import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"

const reasonCopy: Record<string, { title: string; message: string }> = {
  not_found: {
    title: "Link not found",
    message: "This short link does not exist or has been removed.",
  },
  paused: {
    title: "Link is paused",
    message: "The owner paused this link and it cannot redirect right now.",
  },
  archived: {
    title: "Link archived",
    message: "This link has been archived and is no longer active.",
  },
  expired: {
    title: "Link expired",
    message: "This link has passed its expiration time.",
  },
  private: {
    title: "Private link",
    message: "This link is private and not available for public redirects.",
  },
  one_time_consumed: {
    title: "One-time link already used",
    message: "This one-time link was already consumed and cannot be opened again.",
  },
}

export const PublicLinkUnavailablePage = () => {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const reason = (searchParams.get("reason") ?? "not_found").toLowerCase()
  const content = reasonCopy[reason] ?? reasonCopy.not_found

  return (
    <div>
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-error/10 text-error">
        <AlertCircle size={20} />
      </div>

      <h1 className="mt-4 font-poppins text-2xl font-semibold text-neutral-900">{content.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{content.message}</p>

      <div className="mt-4">
        <Badge tone="warning">slug: /{(slug ?? "unknown").toLowerCase()}</Badge>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <a href={`/${encodeURIComponent((slug ?? "").toLowerCase())}`}>
          <Button tone="neutral" className="w-full">
            Retry link
          </Button>
        </a>

        <Link to="/login">
          <Button className="w-full">Open workspace</Button>
        </Link>
      </div>
    </div>
  )
}
