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

// ── react-router navigate ─────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

// ── Redux dispatch/selector ───────────────────────────────────────────────────
const mockDispatch = vi.fn()
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(() => ({})),
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

describe("OrganizationLayout logout (aexa-frontend#249)", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
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
