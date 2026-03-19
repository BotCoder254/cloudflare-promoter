import type { FormEvent } from "react"
import { useState } from "react"
import { Mail } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useRequestPasswordResetMutation } from "../hooks/use-auth-mutations"

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const resetMutation = useRequestPasswordResetMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await resetMutation.mutateAsync({ email })
    setSubmitted(true)
  }

  return (
    <div>
      <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Forgot password</h1>
      <p className="mt-1 text-sm text-neutral-500">Enter your email and we will generate a reset link for playground testing.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="forgot-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-9"
              placeholder="you@company.com"
              required
            />
          </div>
        </div>

        {resetMutation.error ? <p className="text-sm text-error">{resetMutation.error.message}</p> : null}
        {submitted ? (
          <p className="text-sm text-success">If the account exists, a reset link was generated and logged server-side.</p>
        ) : null}

        <Button className="w-full" type="submit" disabled={resetMutation.isPending}>
          {resetMutation.isPending ? "Generating..." : "Request reset link"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-neutral-500">
        Back to{" "}
        <Link to="/login" className="font-semibold text-secondary hover:underline">
          sign in
        </Link>
      </p>
    </div>
  )
}
