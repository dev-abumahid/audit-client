import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import OrganizationLayout from "./OrganizationLayout"

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "organization.nav.settings": "Settings",
        "organization.nav.logout": "Logout",
        "organization.nav.loggedOut": "Logged out",
      }
      return map[key] ?? key
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}))

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

// ── Redux dispatch/selector ───────────────────────────────────────────────────
const mockDispatch = vi.fn()
let mockUserState: Record<string, unknown> = {}
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(() => mockUserState),
}))

// aexa-frontend#510 round 13 -- the Bell nav link's unread dot is now backed
// by real alert data instead of always rendering. Default to an empty list
// (no unread alerts) so existing tests aren't affected by the new query.
const mockUseGetAllAlertsQuery = vi.fn()
vi.mock("@/redux/apis/organization/alert.api", () => ({
  useGetAllAlertsQuery: (...args: unknown[]) =>
    mockUseGetAllAlertsQuery(...args),
}))

function renderOrganizationLayout() {
  return render(
    <MemoryRouter initialEntries={["/organization"]}>
      <Routes>
        <Route path="/organization" element={<OrganizationLayout />}>
          <Route index element={<div>organization content</div>} />
        </Route>
        <Route path="/" element={<div>root landing</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// The dashboard shell previously had no dark/light toggle at all, unlike
// the landing page's NavBar which has always rendered ModeToggle -- this was
// the only surface in the logged-in app with no way to switch themes.
describe("OrganizationLayout theme toggle", () => {
  beforeEach(() => {
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] } })
  })

  it("renders a theme toggle in the header (dashboard dark/light parity)", () => {
    renderOrganizationLayout()
    expect(
      screen.getAllByText("common.toggleTheme").length
    ).toBeGreaterThan(0)
  })
})

describe("OrganizationLayout logout (aexa-frontend#249)", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockUserState = {}
    mockUseGetAllAlertsQuery.mockReset()
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] } })
  })

  it("dispatches both removeUser and resetApiState, then navigates to / when Logout is clicked", async () => {
    const user = userEvent.setup()
    renderOrganizationLayout()

    // Both the desktop and mobile sidebars render the same nav content, so
    // "Logout" appears twice in the DOM -- click the first instance.
    const [logoutButton] = screen.getAllByRole("button", { name: "Logout" })
    await user.click(logoutButton)

    const dispatchedTypes = mockDispatch.mock.calls.map((call) => call[0]?.type)
    expect(dispatchedTypes).toContain("user/removeUser")
    // Regression check for aexa-frontend#249 -- previously only removeUser
    // was dispatched, leaving stale RTK Query cache (e.g.
    // useGetAllOrgUsersQuery data) servable to the next signed-in user.
    expect(dispatchedTypes).toContain("baseApi/resetApiState")
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })
})

// aexa-frontend#494 -- five icon-only sidebar controls (mobile close,
// Settings link, Logout, desktop collapse-toggle, mobile hamburger) lost
// their accessible name once the sidebar is collapsed, the same gap
// AdminLayout.tsx had before round 10's fix (#486/#487). Same test
// structure as AdminLayout.test.tsx's "sidebar control accessible names"
// describe block.
describe("OrganizationLayout sidebar control accessible names (#494)", () => {
  // Both the desktop and mobile <aside> render the same navContent, so
  // every sidebar control appears twice in the DOM -- same rationale as the
  // logout test above using getAllByRole.
  it("gives the mobile sidebar close button and hamburger open button accessible names", () => {
    renderOrganizationLayout()

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
    renderOrganizationLayout()

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
    renderOrganizationLayout()

    const [collapseToggle] = screen.getAllByRole("button", {
      name: "organization.nav.collapseSidebar",
    })
    await user.click(collapseToggle)

    // Once collapsed, the visible <span> label is gone, so the only
    // remaining accessible name comes from the title fallback.
    const [settingsLink] = screen.getAllByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("href", "/organization/settings")
    const [logoutControl] = screen.getAllByRole("button", {
      name: "Logout",
    })
    expect(logoutControl).toBeInTheDocument()
  })
})

// aexa-frontend#510 round 13 -- the Bell nav link previously rendered an
// "unread" red dot unconditionally with no backing data. It's now driven by
// real alert data from useGetAllAlertsQuery (is_read on each Alert), and the
// org logo <img> (when a logo URL exists) now has an accessible alt name to
// match the sibling initials-fallback branch, which already rendered text.
describe("OrganizationLayout alerts indicator and logo alt (#510)", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockUserState = {}
    mockUseGetAllAlertsQuery.mockReset()
  })

  it("does not render the unread dot when there are no unread alerts", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: { data: [{ id: "1", is_read: true }] },
    })
    const { container } = renderOrganizationLayout()

    expect(
      container.querySelector("a[href='/organization/alerts'] .bg-destructive")
    ).not.toBeInTheDocument()
  })

  it("renders the unread dot when at least one alert is unread", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({
      data: {
        data: [
          { id: "1", is_read: true },
          { id: "2", is_read: false },
        ],
      },
    })
    const { container } = renderOrganizationLayout()

    expect(
      container.querySelector("a[href='/organization/alerts'] .bg-destructive")
    ).toBeInTheDocument()
  })

  it("does not render the unread dot when the alerts query has no data yet", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({ data: undefined })
    const { container } = renderOrganizationLayout()

    expect(
      container.querySelector("a[href='/organization/alerts'] .bg-destructive")
    ).not.toBeInTheDocument()
  })

  it("gives the org logo image an accessible alt name instead of rendering it silently", () => {
    mockUseGetAllAlertsQuery.mockReturnValue({ data: { data: [] } })
    mockUserState = {
      organizationProfile: {
        organizationName: "Acme Corp",
        organizationLogo: "https://example.com/logo.png",
      },
    }
    renderOrganizationLayout()

    const logoImages = screen.getAllByRole("img")
    expect(logoImages.length).toBeGreaterThan(0)
    logoImages.forEach((img) => {
      expect(img).toHaveAttribute("alt")
      expect(img.getAttribute("alt")).not.toBe("")
    })
  })
})
