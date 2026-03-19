import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { PublicOnlyRoute, RequireAdminRoute, RequireSessionRoute } from "./components/auth/route-guards"
import { AuthLayout } from "./components/layout/auth-layout"
import { DashboardLayout } from "./components/layout/dashboard-layout"
import { queryClient } from "./lib/query-client"
import { AdminPage } from "./pages/admin-page"
import { DashboardAnalyticsPage } from "./pages/dashboard-analytics-page"
import { DashboardHomePage } from "./pages/dashboard-home-page"
import { DashboardLinkDetailPage } from "./pages/dashboard-link-detail-page"
import { DashboardLinksPage } from "./pages/dashboard-links-page"
import { DashboardSettingsPage } from "./pages/dashboard-settings-page"
import { ForgotPasswordPage } from "./pages/forgot-password-page"
import { LoginPage } from "./pages/login-page"
import { PublicLinkPasswordPage } from "./pages/public-link-password-page"
import { PublicLinkUnavailablePage } from "./pages/public-link-unavailable-page"
import { ResetPasswordPage } from "./pages/reset-password-page"
import { SignupPage } from "./pages/signup-page"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<AuthLayout />}>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route path="/link/:slug/password" element={<PublicLinkPasswordPage />} />
            <Route path="/link/:slug/unavailable" element={<PublicLinkUnavailablePage />} />
          </Route>

          <Route element={<RequireSessionRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHomePage />} />
              <Route path="links" element={<DashboardLinksPage />} />
              <Route path="links/:id" element={<DashboardLinkDetailPage />} />
              <Route path="analytics" element={<DashboardAnalyticsPage />} />
              <Route path="settings" element={<DashboardSettingsPage />} />
            </Route>

            <Route path="/admin" element={<DashboardLayout />}>
              <Route element={<RequireAdminRoute />}>
                <Route index element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
