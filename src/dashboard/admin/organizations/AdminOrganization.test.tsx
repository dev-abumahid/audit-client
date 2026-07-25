import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdminOrganization from "./AdminOrganization"

const mockUseGetAdminOrganizationsQuery = vi.fn()

vi.mock("@/redux/apis/organization/onboarding.api", () => ({
  useGetAdminOrganizationsQuery: (...args: unknown[]) =>
    mockUseGetAdminOrganizationsQuery(...args),
}))

// The wizard pulls in the whole onboarding mutation stack; this page test is
// about the list, so stub it. Opening it is covered implicitly by the button.
vi.mock("./OnboardingWizard", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="onboarding-wizard">
      <button onClick={onClose}>close wizard</button>
    </div>
  ),
}))

function makeOrg(overrides = {}) {
  return {
    id: "acc-1",
    email: "admin@acme.test",
    organizationName: "Acme Corp",
    sector: "Manufacturing",
    country: "France",
    organizationLogo: null,
    isAccountVerified: true,
    createdAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  }
}

function mockList(
  data: ReturnType<typeof makeOrg>[],
  meta = { page: 1, limit: 10, total: data.length, totalPage: 1 },
  flags = { isLoading: false, isFetching: false }
) {
  mockUseGetAdminOrganizationsQuery.mockReturnValue({
    data: { success: true, message: "ok", data, meta },
    ...flags,
  })
}

describe("AdminOrganization", () => {
  beforeEach(() => {
    mockUseGetAdminOrganizationsQuery.mockReset()
  })

  it("renders real organizations from the API (no hardcoded dummy data)", () => {
    mockList([
      makeOrg(),
      makeOrg({
        id: "acc-2",
        organizationName: "Globex",
        email: "ceo@globex.test",
        sector: "Energy",
        country: "Morocco",
      }),
    ])

    render(<AdminOrganization />)

    // The page renders a desktop table and mobile cards simultaneously (CSS
    // hides one), so real row content appears more than once in jsdom.
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Globex").length).toBeGreaterThan(0)
    // The former dummy fixtures must be gone.
    expect(screen.queryByText("TechVision Solutions")).not.toBeInTheDocument()
    expect(screen.queryByText("GreenField Academy")).not.toBeInTheDocument()
  })

  it("shows the real sector/region and email for each org", () => {
    mockList([makeOrg()])

    render(<AdminOrganization />)

    expect(screen.getAllByText("Manufacturing · France").length).toBeGreaterThan(
      0
    )
    // Email is shown in the desktop row's secondary line.
    expect(screen.getByText("admin@acme.test")).toBeInTheDocument()
  })

  it("marks verified accounts Active and unverified ones Pending", () => {
    mockList([
      makeOrg({ isAccountVerified: true }),
      makeOrg({
        id: "acc-2",
        organizationName: "Pending Co",
        isAccountVerified: false,
      }),
    ])

    render(<AdminOrganization />)

    expect(screen.getAllByText("admin.organizations.statusActive").length).toBeGreaterThan(0)
    expect(screen.getAllByText("admin.organizations.statusPending").length).toBeGreaterThan(0)
  })

  it("shows the empty state when there are no organizations", () => {
    mockList([])

    render(<AdminOrganization />)

    expect(screen.getAllByText("admin.organizations.noResults").length).toBeGreaterThan(
      0
    )
  })

  it("passes the typed search term through to the query", async () => {
    mockList([])

    render(<AdminOrganization />)
    await userEvent.type(
      screen.getByPlaceholderText("admin.organizations.searchPlaceholder"),
      "acme"
    )

    await waitFor(() =>
      expect(mockUseGetAdminOrganizationsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "acme", page: 1 })
      )
    )
  })
})
