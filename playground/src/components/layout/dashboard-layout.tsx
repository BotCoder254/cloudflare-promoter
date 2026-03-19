import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"

import { useLogoutMutation } from "../../hooks/use-auth-mutations"
import { useSessionQuery } from "../../hooks/use-session-query"
import { cx } from "../../lib/cx"
import { GoLinksLogo } from "../brand/golinks-logo"
import { Button } from "../ui/button"

const sidebarStorageKey = "golinks.sidebar-collapsed"

type NavigationItem = {
  to: string
  label: string
  icon: (typeof LayoutDashboard)
  adminOnly?: boolean
}

type NavigationSection = {
  title: string
  items: NavigationItem[]
}

const navigationSections: NavigationSection[] = [
  {
    title: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/dashboard/links", label: "Links", icon: Link2 },
      { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Administration",
    items: [{ to: "/admin", label: "Admin", icon: Shield, adminOnly: true }],
  },
]

const resolveSectionTitle = (pathname: string): string => {
  if (pathname.startsWith("/dashboard/links/")) {
    return "Link detail"
  }

  if (pathname.startsWith("/dashboard/links")) {
    return "Links"
  }

  if (pathname.startsWith("/dashboard/analytics")) {
    return "Analytics"
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return "Settings"
  }

  if (pathname.startsWith("/admin")) {
    return "Admin"
  }

  return "Dashboard overview"
}

const getInitials = (name: string) => {
  const segments = name
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (!segments.length) {
    return "GL"
  }

  return `${segments[0][0] ?? "G"}${segments[1]?.[0] ?? segments[0][1] ?? "L"}`.toUpperCase()
}

type SidebarNavigationProps = {
  collapsed: boolean
  isAdmin: boolean
  onNavigate: () => void
}

const SidebarNavigation = ({ collapsed, isAdmin, onNavigate }: SidebarNavigationProps) => {
  const sections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((section) => section.items.length)

  return (
    <nav className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed ? <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{section.title}</p> : null}

          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/dashboard"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      collapsed ? "justify-center" : "gap-3",
                      isActive ? "bg-secondary text-white shadow-sm" : "text-neutral-700 hover:bg-neutral-100",
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </NavLink>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

type SidebarActionsProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  onLogout: () => void
  isLoggingOut: boolean
}

const SidebarActions = ({ collapsed, onToggleCollapse, onLogout, isLoggingOut }: SidebarActionsProps) => {
  return (
    <div className="space-y-2 border-t border-neutral-200/80 px-3 py-3">
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cx(
          "hidden w-full items-center rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 lg:flex",
          collapsed ? "justify-center" : "gap-3",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed ? <span>Collapse</span> : null}
      </button>

      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className={cx(
          "flex w-full items-center rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60",
          collapsed ? "justify-center" : "gap-3",
        )}
      >
        <LogOut size={18} />
        {!collapsed ? <span>{isLoggingOut ? "Signing out..." : "Logout"}</span> : null}
      </button>
    </div>
  )
}

export const DashboardLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionQuery = useSessionQuery()
  const logoutMutation = useLogoutMutation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false
    }

    return window.localStorage.getItem(sidebarStorageKey) === "true"
  })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(sidebarStorageKey, String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  if (sessionQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-600">Loading workspace...</div>
  }

  if (!sessionQuery.data?.user) {
    return <Navigate to="/login" replace />
  }

  const user = sessionQuery.data.user
  const sectionTitle = resolveSectionTitle(location.pathname)
  const userInitials = getInitials(user.name || user.email)

  const handleLogout = async () => {
    await logoutMutation.mutateAsync()
    navigate("/login", { replace: true })
  }

  return (
    <div className="h-screen bg-neutral-50">
      <div className="flex h-full overflow-hidden">
        <aside
          className={cx(
            "sticky top-0 hidden h-screen shrink-0 border-r border-neutral-200/80 bg-white lg:flex lg:flex-col",
            "lg:transition-[width] lg:duration-200",
            isSidebarCollapsed ? "lg:w-24" : "lg:w-72",
          )}
        >
          <div className={cx("flex h-20 items-center border-b border-neutral-200/70", isSidebarCollapsed ? "justify-center px-2" : "px-5")}>
            <GoLinksLogo size={isSidebarCollapsed ? "sm" : "md"} iconOnly={isSidebarCollapsed} />
          </div>

          <div className="flex-1 px-3 py-4">
            <SidebarNavigation
              collapsed={isSidebarCollapsed}
              isAdmin={user.role === "admin"}
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </div>

          <SidebarActions
            collapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
            onLogout={() => void handleLogout()}
            isLoggingOut={logoutMutation.isPending}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="border-b border-neutral-200/80 bg-white/95 backdrop-blur">
            <div className="flex h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-100 lg:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">GoLinks workspace</p>
                <h1 className="truncate font-poppins text-lg font-semibold text-neutral-900 sm:text-xl">{sectionTitle}</h1>
              </div>

              <div className="flex items-center gap-3">
                {user.image ? (
                  <img src={user.image} alt={user.name} className="h-10 w-10 rounded-full border border-neutral-200 object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary">
                    {userInitials}
                  </div>
                )}

                <div className="text-right">
                  <p className="text-sm font-semibold text-neutral-700">{user.name}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-neutral-900/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation overlay"
            />

            <motion.aside
              initial={{ x: -300, opacity: 0.95 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-neutral-200 bg-white p-4 shadow-xl lg:hidden"
            >
              <div className="flex items-center justify-between">
                <GoLinksLogo size="md" />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-100"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close navigation"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4">
                <SidebarNavigation collapsed={false} isAdmin={user.role === "admin"} onNavigate={() => setIsMobileMenuOpen(false)} />
              </div>

              <div className="mt-4 border-t border-neutral-200 pt-4">
                <Button tone="neutral" className="w-full justify-start gap-2" onClick={handleLogout} disabled={logoutMutation.isPending}>
                  <LogOut size={16} />
                  {logoutMutation.isPending ? "Signing out..." : "Logout"}
                </Button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
