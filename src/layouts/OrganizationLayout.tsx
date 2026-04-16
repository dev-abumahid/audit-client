import CriticalAlertBanner from "@/components/dashboard/organization/CriticalAlertBanner"
import LanguageSwitcher from "@/components/shared/LanguageSwitcher"
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
  Search,
  Settings,
  Shield,
  TrendingUp,
  X,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router"

export default function OrganizationLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation()

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

  const initials = "OR"

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed ? (
          <Link
            to="/organization"
            className="flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">
                AEXA
              </span>
              <span className="ml-1 text-[10px] font-medium text-sidebar-foreground/70">
                v3.0
              </span>
            </div>
          </Link>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
        )}

        <button
          onClick={() => setMobileOpen(false)}
          className="rounded p-1.5 text-sidebar-foreground hover:text-sidebar-accent-foreground lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-sidebar-foreground/60 uppercase">
                {section.label}
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
                      className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      } ${collapsed ? "justify-center px-2" : ""}`}
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
          to="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span>{t("organization.nav.settings")}</span>}
        </Link>

        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>{t("organization.nav.logout")}</span>}
        </button>

        {/* Collapse Toggle (Desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden w-full items-center justify-center rounded-md py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
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
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative hidden w-80 sm:block">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-full rounded-md border border-input bg-background pr-4 pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/alerts"
              className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </Link>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
          </div>
        </header>

        {/* Critical Alert Banner */}
        <CriticalAlertBanner />

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
