import type { FormEvent } from "react"
import { useState } from "react"
import { LockKeyhole } from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useVerifyPublicLinkPasswordMutation } from "../hooks/use-links"

export const PublicLinkPasswordPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const verifyMutation = useVerifyPublicLinkPasswordMutation()
  const [password, setPassword] = useState("")

  const normalizedSlug = (slug ?? "").trim().toLowerCase()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!normalizedSlug) {
      return
    }

    try {
      const result = await verifyMutation.mutateAsync({
        slug: normalizedSlug,
        password,
      })

      window.location.assign(result.redirectTo)
    } catch {
      return
    }
  }

  return (
    <div>
      <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Protected link</h1>
      <p className="mt-1 text-sm text-neutral-500">Enter the password to continue to /{normalizedSlug || "link"}.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="public-link-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Link password
          </label>

          <div className="relative">
            <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
            <Input
              id="public-link-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-9"
              placeholder="Enter password"
              minLength={1}
              required
            />
          </div>
        </div>

        {verifyMutation.error ? <p className="text-sm text-error">{verifyMutation.error.message}</p> : null}

        <Button className="w-full" type="submit" disabled={verifyMutation.isPending || !normalizedSlug}>
          {verifyMutation.isPending ? "Verifying..." : "Unlock link"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-neutral-500">
        Need workspace access?{" "}
        <Link to="/login" className="font-semibold text-secondary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
