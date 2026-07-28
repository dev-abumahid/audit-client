import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import OrganizationLayout from "./OrganizationLayout"

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
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
    </MemoryRouter>,
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

    const dispatchedTypes = mockDispatch.mock.calls.map(
      (call) => call[0]?.type,
    )
    expect(dispatchedTypes).toContain("user/removeUser")
    // Regression check for aexa-frontend#249 -- previously only removeUser
    // was dispatched, leaving stale RTK Query cache (e.g.
    // useGetAllOrgUsersQuery data) servable to the next signed-in user.
    expect(dispatchedTypes).toContain("baseApi/resetApiState")
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })
})
