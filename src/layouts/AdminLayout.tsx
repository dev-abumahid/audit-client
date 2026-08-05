import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
import Logo from "@/components/shared/Logo"
import { baseApi } from "@/redux/baseApi"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { removeUser } from "@/redux/slices/user.slice"
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  X,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

export default function AdminLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation()
  const user = useAppSelector((state) => state.user)

  // handlers
  const logOutHandler = () => {
    dispatch(removeUser())
    dispatch(baseApi.util.resetApiState())
    navigate("/")
    toast.success(t("organization.nav.loggedOut"))
  }

  const NAV_SECTIONS = [
    {
      label: t("admin.nav.dashboard"),
      items: [
        {
          path: "/admin",
          label: t("admin.nav.overview"),
          icon: LayoutDashboard,
        },
        {
          path: "/admin/transaction",
          label: t("admin.nav.transaction"),
          icon: TrendingUp,
        },
        {
          path: "/admin/organizations",
          label: t("admin.nav.organizations"),
          icon: Building2,
        },
      ],
    },
  ]

  // Derive initials from the logged-in admin's real profile data (mirrors
  // the pattern used for org avatars in AdminOrganization.tsx) instead of a
  // hardcoded "OR" placeholder. Falls back to the account email when no
  // display name is set yet.
  const initials = (() => {
    const fullName = user?.userProfile?.fullName?.trim()
    if (fullName) {
      return fullName
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email ? user.email.slice(0, 2).toUpperCase() : "--"
  })()

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed ? (
          <Link
            to="/organization"
            className="focus-ring-sidebar flex items-center gap-2 rounded-md"
            onClick={() => setMobileOpen(false)}
          >
            <Logo className="qiyrix-mark--sidebar h-8 w-8 shrink-0" />
            <span className="font-heading text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
              Qiyrix
            </span>
          </Link>
        ) : (
          <Logo className="qiyrix-mark--sidebar mx-auto h-8 w-8" />
        )}

        <button
          onClick={() => setMobileOpen(false)}
          aria-label={t("organization.nav.closeSidebar")}
          className="focus-ring-sidebar rounded p-1.5 text-sidebar-foreground hover:text-sidebar-accent-foreground lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="animate-fade-in flex-1 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <p className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold tracking-widest text-sidebar-foreground/60 uppercase">
                {section.label}
                <span className="h-px flex-1 bg-sidebar-border" />
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`focus-ring-sidebar group relative flex items-center gap-3 rounded-md border-l-2 py-2.5 pr-3 pl-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-primary"
                          : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      } ${collapsed ? "justify-center border-l-0 px-2" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground"
                        }`}
                      />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <Link
          to="/admin/settings"
          onClick={() => setMobileOpen(false)}
          className={`focus-ring-sidebar flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? t("organization.nav.settings") : undefined}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span>{t("organization.nav.settings")}</span>}
        </Link>

        <button
          onClick={logOutHandler}
          className="focus-ring-sidebar flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title={collapsed ? t("organization.nav.logout") : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>{t("organization.nav.logout")}</span>}
        </button>

        {/* Collapse Toggle (Desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={
            collapsed
              ? t("organization.nav.expandSidebar")
              : t("organization.nav.collapseSidebar")
          }
          className="focus-ring-sidebar hidden w-full items-center justify-center rounded-md py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      {/* Main Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={t("organization.nav.openSidebar")}
              className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {/* No admin alerts/notifications feature exists yet (there's no
                /admin/alerts route and no admin notification state) -- this
                is a static visual icon rather than a dead link or a fake
                "you have notifications" dot. */}
            <div className="rounded-md p-2 text-muted-foreground">
              <Bell className="h-4 w-4" />
            </div>

            <div className="font-heading ring-border/60 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2">
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
