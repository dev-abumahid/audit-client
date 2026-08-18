import { ModeToggle } from "@/components/mode-toggle"
import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
import Logo from "@/components/shared/Logo"
import { useGetAllAlertsQuery } from "@/redux/apis/organization/alert.api"
import { baseApi } from "@/redux/baseApi"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { removeUser } from "@/redux/slices/user.slice"
import {
  Activity,
  AlertTriangle,
  Bell,
  Building,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GitBranch,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Radio,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

export default function OrganizationLayout() {
  const user = useAppSelector((state) => state.user)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  // Prefer the logged-in user's own initials (mirrors AdminLayout.tsx's
  // identical pattern) over the organization's initial -- an ORGANIZATION-
  // role account has no personal userProfile (auth.d.ts), so it falls back
  // to the org initial exactly as before for that case.
  const avatarInitials = (() => {
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
    return user?.organizationProfile?.organizationName?.charAt(0)
  })()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation()
  // Real unread-alert state for the Bell nav link's indicator dot (aexa-frontend#510
  // round 13 — the dot previously rendered unconditionally with no backing data).
  // This layout only mounts behind the org auth guard, so the query can run
  // unconditionally, same as AlertsPage's own useGetAllAlertsQuery(undefined) call.
  const { data: alertsData } = useGetAllAlertsQuery(undefined)
  const hasUnreadAlerts = !!alertsData?.data?.some((alert) => !alert.is_read)

  // handlers
  const logOutHandler = () => {
    dispatch(removeUser())
    dispatch(baseApi.util.resetApiState())
    navigate("/")
    toast.success(t("organization.nav.loggedOut"))
  }

  const NAV_SECTIONS = [
    {
      label: t("organization.nav.analyze"),
      items: [
        {
          path: "/organization",
          label: t("organization.nav.dashboard"),
          icon: LayoutDashboard,
        },
        {
          path: "/organization/sites",
          label: t("organization.nav.sitesEntities"),
          icon: Building,
        },
        {
          path: "/organization/risks",
          label: t("organization.nav.riskRegister"),
          icon: Shield,
        },
        {
          path: "/organization/risk-matrix",
          label: t("organization.nav.matrix5x5"),
          icon: Grid3X3,
        },
        {
          path: "/organization/correlation-matrix",
          label: t("organization.nav.correlationMatrix"),
          icon: GitBranch,
        },
        {
          path: "/organization/risk-graph",
          label: t("organization.nav.pageRankGraph"),
          icon: Network,
        },
        {
          path: "/organization/kri",
          label: t("organization.nav.kriDashboard"),
          icon: Activity,
        },
      ],
    },
    {
      label: t("organization.nav.intelligence"),
      items: [
        {
          path: "/organization/intelligence",
          label: t("organization.nav.threatIntel"),
          icon: Radio,
        },
        {
          path: "/organization/alerts",
          label: t("organization.nav.alerts"),
          icon: Bell,
        },
      ],
    },
    {
      label: t("organization.nav.governance"),
      items: [
        {
          path: "/organization/compliance",
          label: t("organization.nav.regulatoryCompliance"),
          icon: Scale,
        },
        {
          path: "/organization/three-lines-of-defense",
          label: t("organization.nav.threeLinesOfDefense"),
          icon: ShieldCheck,
        },
        {
          path: "/organization/audit",
          label: t("organization.nav.auditMissions"),
          icon: ClipboardCheck,
        },
        {
          path: "/organization/audit/templates",
          label: t("organization.nav.templates"),
          icon: ClipboardCheck,
        },
        {
          path: "/organization/audit/inspections",
          label: t("organization.nav.inspections"),
          icon: ClipboardCheck,
        },
        {
          path: "/organization/findings",
          label: t("organization.nav.findings"),
          icon: AlertTriangle,
        },
        {
          path: "/organization/reports",
          label: t("organization.nav.boardReports"),
          icon: FileText,
        },
      ],
    },
  ]

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
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={t("organization.nav.closeSidebar")}
          className="focus-ring-sidebar rounded p-1.5 text-sidebar-foreground hover:text-sidebar-accent-foreground lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="animate-fade-in flex-1 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section, sectionIdx) => (
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
            {sectionIdx < NAV_SECTIONS.length - 1 && !collapsed && (
              <div className="mt-6 border-t border-sidebar-border/60" />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <Link
          to="/organization/settings"
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
          type="button"
          onClick={logOutHandler}
          className="focus-ring-sidebar flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title={collapsed ? t("organization.nav.logout") : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>{t("organization.nav.logout")}</span>}
        </button>

        {/* Collapse Toggle (Desktop) */}
        <button
          type="button"
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
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t("organization.nav.openSidebar")}
              className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ModeToggle />
            <LanguageSwitcher />
            <Link
              to="/organization/alerts"
              className="focus-ring relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {hasUnreadAlerts && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>

            <Link
              to="/organization/settings"
              aria-label={t("organization.nav.profileLinkLabel")}
              className="font-heading ring-border/60 focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground uppercase ring-2 transition-opacity hover:opacity-90"
            >
              {(user?.organizationProfile?.organizationLogo as string) ? (
                <img
                  src={user?.organizationProfile?.organizationLogo}
                  alt={t("organization.nav.orgLogoAlt", {
                    name: user?.organizationProfile?.organizationName || "",
                  })}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <>{avatarInitials}</>
              )}
            </Link>
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
