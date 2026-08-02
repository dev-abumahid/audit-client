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
        "admin.nav.searchPlaceholder": "Search...",
      }
      return map[key] ?? key
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}))

// ── sonner ────────────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

  it("uses a translated search placeholder instead of a hardcoded string (aexa-frontend#367)", () => {
    renderAdminLayout()
    expect(screen.getAllByPlaceholderText("Search...").length).toBeGreaterThan(
      0,
    )
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
})
