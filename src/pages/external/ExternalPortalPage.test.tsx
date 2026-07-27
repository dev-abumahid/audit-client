import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ExternalPortalPage from "./ExternalPortalPage"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "externalAuth.portal.greeting") return `Welcome, ${opts?.name}`
      const map: Record<string, string> = {
        "externalAuth.portal.placeholder":
          "Your assigned findings will appear here soon.",
        "externalAuth.portal.signOut": "Sign out",
      }
      return map[key] ?? key
    },
  }),
}))

const mockDispatch = vi.fn()
let mockExternalUser: {
  externalOrgMemberId: string
  organizationId: string
  email: string
  fullName: string | null
} = {
  externalOrgMemberId: "ext-1",
  organizationId: "org-42",
  email: "reviewer@partnerfirm.com",
  fullName: "Reviewer One",
}
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ externalUser: mockExternalUser }),
}))

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

describe("ExternalPortalPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset()
    mockNavigate.mockReset()
  })

  it("greets the signed-in external member by their full name", () => {
    render(<ExternalPortalPage />)
    expect(screen.getByText("Welcome, Reviewer One")).toBeInTheDocument()
  })

  it("falls back to email when fullName is null", () => {
    mockExternalUser = { ...mockExternalUser, fullName: null }
    render(<ExternalPortalPage />)
    expect(
      screen.getByText("Welcome, reviewer@partnerfirm.com")
    ).toBeInTheDocument()
  })

  it("clears the external session and navigates home on sign out", async () => {
    const user = userEvent.setup()
    render(<ExternalPortalPage />)

    await user.click(screen.getByRole("button", { name: "Sign out" }))

    expect(mockDispatch).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })
})
