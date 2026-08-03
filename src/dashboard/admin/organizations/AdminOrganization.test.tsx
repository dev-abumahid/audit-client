import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdminOrganization from "./AdminOrganization"

// Controllable `i18n.language` for the locale-formatting test below, same
// technique as FindingDetails.test.tsx/TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return { ...real, i18n: { ...real.i18n, language: mockLanguage } }
    },
  }
})

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
    mockLanguage = undefined
  })

  // Issue #364: the "Joined" date used a local formatDate() hardcoded to
  // toLocaleDateString("en-US", ...), ignoring the app's selected language.
  // Now goes through the shared formatLocaleDate helper.
  describe("locale-aware joined-date formatting (#364)", () => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    }

    it("formats the joined date using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      mockList([makeOrg({ createdAt: "2026-06-01T10:00:00.000Z" })])

      render(<AdminOrganization />)

      const expected = new Date(
        "2026-06-01T10:00:00.000Z"
      ).toLocaleDateString("fr-FR", dateOptions)
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })

    it("formats the joined date using the English locale by default", () => {
      mockList([makeOrg({ createdAt: "2026-06-01T10:00:00.000Z" })])

      render(<AdminOrganization />)

      const expected = new Date(
        "2026-06-01T10:00:00.000Z"
      ).toLocaleDateString("en-US", dateOptions)
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })
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

  // Issue #384: the row "..." (MoreHorizontal) button had no onClick and no
  // destination existed anywhere in the codebase to link it to, so it was
  // removed rather than left as a dead affordance.
  it("does not render a dead '...' row-options button (aexa-frontend#384)", () => {
    mockList([makeOrg()])

    render(<AdminOrganization />)

    expect(document.querySelector("svg.lucide-more-horizontal")).toBeNull()
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

  // aexa-frontend#486 -- the Prev/Next pagination icon buttons had no
  // aria-label/title, unlike the equivalent pattern in
  // CompliancePage.tsx/AuditPage.tsx.
  it("gives the Prev/Next pagination buttons accessible names", () => {
    mockList([makeOrg()], { page: 1, limit: 10, total: 25, totalPage: 3 })

    render(<AdminOrganization />)

    expect(
      screen.getByRole("button", {
        name: "admin.organizations.paginationPrevious",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "admin.organizations.paginationNext",
      })
    ).toBeInTheDocument()
  })
})
