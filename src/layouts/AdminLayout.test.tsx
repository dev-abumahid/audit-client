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

// ── Redux dispatch ─────────────────────────────────────────────────────────────
const mockDispatch = vi.fn()
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
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
})
