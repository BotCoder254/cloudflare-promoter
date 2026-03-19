import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useSessionQuery } from "../../hooks/use-session-query"

const GuardLoading = () => {
  return <div className="flex min-h-screen items-center justify-center text-neutral-600">Loading workspace...</div>
}

export const RequireSessionRoute = () => {
  const location = useLocation()
  const sessionQuery = useSessionQuery()

  if (sessionQuery.isLoading) {
    return <GuardLoading />
  }

  if (!sessionQuery.data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export const RequireAdminRoute = () => {
  const location = useLocation()
  const sessionQuery = useSessionQuery()

  if (sessionQuery.isLoading) {
    return <GuardLoading />
  }

  if (!sessionQuery.data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (sessionQuery.data.user.role !== "admin") {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export const PublicOnlyRoute = () => {
  const sessionQuery = useSessionQuery()

  if (sessionQuery.isLoading) {
    return <GuardLoading />
  }

  if (sessionQuery.data?.user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
