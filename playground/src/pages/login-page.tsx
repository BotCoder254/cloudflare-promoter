import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff, Github, LockKeyhole, Mail } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useLoginMutation, useSocialLoginMutation } from "../hooks/use-auth-mutations"
import { useSessionQuery } from "../hooks/use-session-query"
import { useAuthProvidersQuery } from "../hooks/use-platform-data"
import type { SocialProvider } from "../shared/models"

export const LoginPage = () => {
  const navigate = useNavigate()
  const sessionQuery = useSessionQuery()
  const loginMutation = useLoginMutation()
  const socialLoginMutation = useSocialLoginMutation()
  const providersQuery = useAuthProvidersQuery()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  useEffect(() => {
    if (sessionQuery.data?.user) {
      navigate("/dashboard", { replace: true })
    }
  }, [navigate, sessionQuery.data?.user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await loginMutation.mutateAsync({
      email,
      password,
      rememberMe,
    })
  }

  const handleSocialLogin = async (provider: SocialProvider) => {
    await socialLoginMutation.mutateAsync(provider)
  }

  return (
    <div>
      <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-500">Continue to your protected workspace and dashboard APIs.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-9"
              placeholder="you@company.com"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Password
          </label>
          <div className="relative">
            <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-9 pr-10"
              placeholder="Minimum 8 characters"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-3 text-neutral-500 transition-colors hover:text-neutral-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-secondary focus:ring-secondary"
          />
          Keep me signed in
        </label>

        {loginMutation.error ? <p className="text-sm text-error">{loginMutation.error.message}</p> : null}

        <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
          <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </motion.div>
      </form>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Or continue with</p>
        <div className="mt-3 space-y-2">
          {providersQuery.data?.socialProviders.includes("github") ? (
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
              <Button
                tone="neutral"
                className="w-full gap-2"
                onClick={() => void handleSocialLogin("github")}
                disabled={socialLoginMutation.isPending}
              >
                <Github size={16} />
                Continue with GitHub
              </Button>
            </motion.div>
          ) : null}

          {providersQuery.data?.socialProviders.includes("google") ? (
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
              <Button
                tone="neutral"
                className="w-full"
                onClick={() => void handleSocialLogin("google")}
                disabled={socialLoginMutation.isPending}
              >
                Continue with Google
              </Button>
            </motion.div>
          ) : null}

          {!providersQuery.data?.socialProviders.length ? (
            <p className="text-sm text-neutral-500">No social provider configured in env. Use email/password.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="font-semibold text-secondary hover:underline">
          Forgot password?
        </Link>
        <p className="text-neutral-500">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-secondary hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
