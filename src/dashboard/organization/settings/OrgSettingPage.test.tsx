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
      screen.getByRole("tab", { name: "organization.settings.tabTeam" })
    )

    expect(screen.getByTestId("team-members-tab")).toBeInTheDocument()
  })

  it("marks the tabs with tablist/tab ARIA roles and the active tab as selected", () => {
    render(<OrgSettingPage />)

    expect(screen.getByRole("tablist")).toBeInTheDocument()
    const profileTab = screen.getByRole("tab", {
      name: "organization.settings.tabUserSettings",
    })
    const teamTab = screen.getByRole("tab", {
      name: "organization.settings.tabTeam",
    })
    expect(profileTab).toHaveAttribute("aria-selected", "true")
    expect(teamTab).toHaveAttribute("aria-selected", "false")
  })

  // aexa-frontend#464 review round 1: the tab <-> tabpanel id linkage
  // (aria-controls on the tab, id + aria-labelledby on the panel) had no
  // test -- a typo in any of those three attributes would have shipped
  // silently since the tablist/aria-selected test above doesn't touch them.
  it("wires each tab's aria-controls to the matching tabpanel's id, and each tabpanel's aria-labelledby back to its tab", async () => {
    const user = userEvent.setup()
    render(<OrgSettingPage />)

    const profileTab = screen.getByRole("tab", {
      name: "organization.settings.tabUserSettings",
    })
    const profilePanel = screen.getByRole("tabpanel")
    expect(profileTab).toHaveAttribute("aria-controls", profilePanel.id)
    expect(profilePanel).toHaveAttribute("aria-labelledby", profileTab.id)

    const teamTab = screen.getByRole("tab", {
      name: "organization.settings.tabTeam",
    })
    await user.click(teamTab)
    const teamPanel = screen.getByRole("tabpanel")
    expect(teamTab).toHaveAttribute("aria-controls", teamPanel.id)
    expect(teamPanel).toHaveAttribute("aria-labelledby", teamTab.id)

    const knowledgeTab = screen.getByRole("tab", {
      name: "organization.settings.tabKnowledgeBase",
    })
    await user.click(knowledgeTab)
    const knowledgePanel = screen.getByRole("tabpanel")
    expect(knowledgeTab).toHaveAttribute("aria-controls", knowledgePanel.id)
    expect(knowledgePanel).toHaveAttribute("aria-labelledby", knowledgeTab.id)
  })
})
