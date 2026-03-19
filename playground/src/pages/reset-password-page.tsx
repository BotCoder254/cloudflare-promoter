import type { FormEvent } from "react"
import { useState } from "react"
import { Eye, EyeOff, LockKeyhole } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useResetPasswordMutation } from "../hooks/use-auth-mutations"

export const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resetMutation = useResetPasswordMutation()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [completed, setCompleted] = useState(false)

  const token = searchParams.get("token")?.trim() ?? ""
  const hasToken = token.length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasToken) {
      return
    }

    await resetMutation.mutateAsync({
      token,
      newPassword,
      confirmPassword,
    })

    setCompleted(true)
    window.setTimeout(() => {
      navigate("/login", { replace: true })
    }, 900)
  }

  return (
    <div>
      <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Reset password</h1>
      <p className="mt-1 text-sm text-neutral-500">Set a new password to regain access to your protected dashboard.</p>

      {!hasToken ? (
        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-neutral-700">
          Missing reset token in URL. Use a link generated from the forgot-password flow.
        </p>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reset-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            New password
          </label>
          <div className="relative">
            <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
            <Input
              id="reset-password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="pl-9 pr-10"
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              disabled={!hasToken}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((value) => !value)}
              className="absolute right-3 top-3 text-neutral-500 transition-colors hover:text-neutral-700"
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="reset-confirm-password"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Confirm password
          </label>
          <div className="relative">
            <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
            <Input
              id="reset-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="pl-9 pr-10"
              placeholder="Repeat your new password"
              required
              minLength={8}
              disabled={!hasToken}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-3 top-3 text-neutral-500 transition-colors hover:text-neutral-700"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {resetMutation.error ? <p className="text-sm text-error">{resetMutation.error.message}</p> : null}
        {completed ? <p className="text-sm text-success">Password reset complete. Redirecting to sign in...</p> : null}

        <Button className="w-full" type="submit" disabled={resetMutation.isPending || !hasToken}>
          {resetMutation.isPending ? "Saving..." : "Set new password"}
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
