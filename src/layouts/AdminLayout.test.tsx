import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import AdminLayout from "./AdminLayout"

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "organization.nav.settings": "Settings",
        "organization.nav.logout": "Logout",
        "organization.nav.loggedOut": "Logged out",
        "admin.nav.dashboard": "Dashboard",
        "admin.nav.overview": "Overview",
        "admin.nav.transaction": "Transaction",
        "admin.nav.organizations": "Organizations",
      }
      return map[key] ?? key
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}))

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// LanguageSwitcher's own type="button" fix lives in a separate PR (batch
// 4 of the app-wide sweep) -- mocked out here as a black box so this
// file's own button-type sweep test below isn't cross-coupled to a
// different PR's file, matching TeamMembersTab.test.tsx's convention of
// mocking out ExternalMembersSection.
vi.mock("@/components/shared/LanguageSwitcher", () => ({
  default: () => <div data-testid="language-switcher" />,
}))

// ── theme provider (ModeToggle's dependency) ────────────────────────────────────
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}))

// ── react-router navigate ─────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

// ── Redux dispatch / selector ───────────────────────────────────────────────────
const mockDispatch = vi.fn()
const mockUseAppSelector = vi.fn()
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    mockUseAppSelector(selector),
}))

function renderAdminLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>admin content</div>} />
        </Route>
        <Route path="/" element={<div>root landing</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("AdminLayout (aexa-frontend#248)", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockUseAppSelector.mockReset()
    mockUseAppSelector.mockReturnValue({
      email: "admin@example.com",
      userProfile: { fullName: "" },
    })
  })

  it("dispatches removeUser and resetApiState, then navigates to / when Logout is clicked", async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    // Sanity check: the pre-fix bug rendered Logout as a plain <Link to="/">
    // with no click handler at all, so it must be an actionable control that
    // supports onClick semantics (a button, not a bare anchor navigation).
    // Both the desktop and mobile sidebars render the same nav content, so
    // "Logout" appears twice in the DOM -- click the first instance.
    const [logoutControl] = screen.getAllByRole("button", { name: "Logout" })

    await user.click(logoutControl)

    const dispatchedTypes = mockDispatch.mock.calls.map(
      (call) => call[0]?.type,
    )
    expect(dispatchedTypes).toContain("user/removeUser")
    expect(dispatchedTypes).toContain("baseApi/resetApiState")
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("still renders normal sidebar navigation links (e.g. Settings) as plain links", () => {
    renderAdminLayout()
    const [settingsLink] = screen.getAllByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/admin/settings")
  })

  it("renders sidebar nav items with real routes and translated labels (aexa-frontend#367)", () => {
    renderAdminLayout()
    const [overviewLink] = screen.getAllByRole("link", { name: "Overview" })
    expect(overviewLink).toHaveAttribute("href", "/admin")
    const [transactionLink] = screen.getAllByRole("link", {
      name: "Transaction",
    })
    expect(transactionLink).toHaveAttribute("href", "/admin/transaction")
    const [organizationsLink] = screen.getAllByRole("link", {
      name: "Organizations",
    })
    expect(organizationsLink).toHaveAttribute("href", "/admin/organizations")
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0)
  })

  // Issue #385: the header search box had no state or handler at all -- it
  // was a fake input that silently did nothing. AdminOrganization.tsx (the
  // only admin page with anything to search) already has its own working
  // search input, so a second non-functional one in the shared header was
  // just a dead affordance and has been removed rather than wired up.
  it("does not render a non-functional header search box (aexa-frontend#385)", () => {
    renderAdminLayout()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  // The dashboard shell previously had no dark/light toggle at all, unlike
  // the landing page's NavBar which has always rendered ModeToggle -- this
  // was the only surface in the logged-in app with no way to switch themes.
  it("renders a theme toggle in the header (dashboard dark/light parity)", () => {
    renderAdminLayout()
    expect(
      screen.getAllByText("common.toggleTheme").length
    ).toBeGreaterThan(0)
  })

  it("does not link the bell icon anywhere and shows no fake notification dot (aexa-frontend#365, #366)", () => {
    renderAdminLayout()
    // The bell used to link to /admin/alerts, a route that doesn't exist.
    expect(
      screen.queryByRole("link", { name: /alerts/i }),
    ).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/admin/alerts"]')).toBeNull()
    // The hardcoded "always has a notification" dot must be gone.
    expect(document.querySelector(".bg-destructive")).toBeNull()
  })

  it("derives the avatar initials from the logged-in admin's real name instead of a hardcoded value (aexa-frontend#366)", () => {
    mockUseAppSelector.mockReturnValue({
      email: "jane.doe@example.com",
      userProfile: { fullName: "Jane Doe" },
    })
    renderAdminLayout()
    expect(screen.getAllByText("JD").length).toBeGreaterThan(0)
    expect(screen.queryByText("OR")).not.toBeInTheDocument()
  })

  it("falls back to initials derived from the email when no display name is set", () => {
    mockUseAppSelector.mockReturnValue({
      email: "admin@example.com",
      userProfile: { fullName: "" },
    })
    renderAdminLayout()
    expect(screen.getAllByText("AD").length).toBeGreaterThan(0)
  })

  // aexa-frontend#486 -- several icon-only sidebar controls (mobile close,
  // Logout, Settings link, desktop collapse-toggle, mobile hamburger) lose
  // their accessible name once the sidebar is collapsed, unlike the sidebar
  // nav Link items just above them, which already fall back to
  // title={collapsed ? item.label : undefined}.
  describe("sidebar control accessible names (#486)", () => {
    // Both the desktop and mobile <aside> render the same navContent (one
    // is hidden with CSS depending on viewport, which jsdom doesn't apply),
    // so every sidebar control appears twice in the DOM -- same rationale
    // as the existing "Logout" test above using getAllByRole.
    it("gives the mobile sidebar close button and hamburger open button accessible names", () => {
      renderAdminLayout()

      expect(
        screen.getAllByRole("button", {
          name: "organization.nav.closeSidebar",
        }).length
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByRole("button", { name: "organization.nav.openSidebar" })
          .length
      ).toBeGreaterThan(0)
    })

    it("gives the desktop collapse-toggle button an accessible name that flips with collapsed state", async () => {
      const user = userEvent.setup()
      renderAdminLayout()

      expect(
        screen.getAllByRole("button", {
          name: "organization.nav.collapseSidebar",
        }).length
      ).toBeGreaterThan(0)

      const [collapseToggle] = screen.getAllByRole("button", {
        name: "organization.nav.collapseSidebar",
      })
      await user.click(collapseToggle)

      expect(
        screen.getAllByRole("button", {
          name: "organization.nav.expandSidebar",
        }).length
      ).toBeGreaterThan(0)
    })

    it("keeps Settings and Logout reachable by name once the sidebar is collapsed", async () => {
      const user = userEvent.setup()
      renderAdminLayout()

      const [collapseToggle] = screen.getAllByRole("button", {
        name: "organization.nav.collapseSidebar",
      })
      await user.click(collapseToggle)

      // Once collapsed, the visible <span> label is gone, so the only
      // remaining accessible name comes from the title fallback.
      const [settingsLink] = screen.getAllByRole("link", { name: "Settings" })
      expect(settingsLink).toHaveAttribute("href", "/admin/settings")
      const [logoutControl] = screen.getAllByRole("button", {
        name: "Logout",
      })
      expect(logoutControl).toBeInTheDocument()
    })
  })

  // Raw <button>s with no explicit type default to type="submit" per the
  // HTML spec -- a latent bug if this layout's sidebar/header ever ends up
  // inside a <form>. Every button this layout renders is a raw <button> (no
  // shadcn <Button> usage here), and all of them render unconditionally in
  // the default fixture, so a full sweep covers all of them. Same pattern
  // as InspectionActions.test.tsx's "gives every button an explicit type"
  // test.
  it("gives every button an explicit type so none default to implicit submit", () => {
    renderAdminLayout()

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
