import { motion } from "framer-motion"
import { Outlet, useLocation } from "react-router-dom"

import { GoLinksLogo } from "../brand/golinks-logo"

export const AuthLayout = () => {
  const year = new Date().getFullYear()
  const location = useLocation()
  const isPublicLinkRoute = location.pathname.startsWith("/link/")

  const heroImage = isPublicLinkRoute
    ? "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2000&q=80"
    : "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=2000&q=80"

  const heroAlt = isPublicLinkRoute
    ? "Secure access gateway interface with global network backdrop"
    : "Engineering workspace with modern software dashboard visuals"

  const heroDescription = isPublicLinkRoute
    ? "Protected link access with short-lived unlock sessions, secure redirect checks, and expiration-aware controls."
    : "Launch secure short links with full-stack authentication, provider linking, and Worker-native APIs."

  const panelDescription = isPublicLinkRoute
    ? "Use link password verification to continue to the destination safely."
    : "Email/password auth with social sign-in, sessions, and protected dashboard access."

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
        <section className="relative hidden min-h-screen lg:block">
          <img
            src={heroImage}
            alt={heroAlt}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-neutral-900/55" />

          <div className="absolute inset-0 flex flex-col justify-between p-10 text-white">
            <div>
              <GoLinksLogo size="xl" inverted />
              <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-100">
                {heroDescription}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-100">GoLinks Playground</p>
              <p className="mt-1 text-xs text-neutral-100">Copyright {year} golinks. All rights reserved.</p>
            </div>
          </div>
        </section>

        <div className="flex min-h-screen items-center justify-center px-6 py-8 sm:px-10 lg:px-14">
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <GoLinksLogo size="lg" />
            <p className="mt-2 text-sm text-neutral-500">{panelDescription}</p>

            <div className="mt-8">
              <Outlet />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
