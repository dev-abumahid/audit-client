import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import OrgSettingPage from "./OrgSettingPage"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention).

const mockUseGetMeQuery = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useGetMeQuery: (...args: unknown[]) => mockUseGetMeQuery(...args),
}))

// The tab child components are exercised by their own suites; stub them so this
// page-level test focuses on the settings chrome and tab switching.
vi.mock("./KnowledgeBaseUploadingForm", () => ({
  default: () => <div data-testid="knowledge-form" />,
}))
vi.mock("./PasswordChangeForm", () => ({
  default: () => <div data-testid="password-form" />,
}))
vi.mock("./PersonalInfoForm", () => ({
  default: () => <div data-testid="personal-info-form" />,
}))
vi.mock("./TeamMembersTab", () => ({
  default: () => <div data-testid="team-members-tab" />,
}))

describe("OrgSettingPage", () => {
  beforeEach(() => {
    mockUseGetMeQuery.mockReset()
    mockUseGetMeQuery.mockReturnValue({
      data: {
        data: {
          email: "user@acme.com",
          profile: { fullName: "Jane Doe", profilePhoto: null },
          organizationProfile: { organizationName: "Acme Corp" },
        },
      },
    })
  })

  it("renders the localized header and organization info", () => {
    render(<OrgSettingPage />)

    expect(screen.getByText("organization.settings.title")).toBeInTheDocument()
    expect(
      screen.getByText("organization.settings.subtitle")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.settings.orgInformation")
    ).toBeInTheDocument()
    // The real org data still renders alongside the localized labels.
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
    expect(screen.getByText("user@acme.com")).toBeInTheDocument()
  })

  it("switches to the Team tab and renders its content", async () => {
    const user = userEvent.setup()
    render(<OrgSettingPage />)

    await user.click(
      screen.getByRole("button", { name: "organization.settings.tabTeam" })
    )

    expect(screen.getByTestId("team-members-tab")).toBeInTheDocument()
  })
})
