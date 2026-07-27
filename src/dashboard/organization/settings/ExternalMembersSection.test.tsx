import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ExternalMembersSection from "./ExternalMembersSection"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetExternalMembersQuery = vi.fn()
const mockInviteExternalMember = vi.fn()
vi.mock("@/redux/apis/organization/externalMember.api", () => ({
  useGetExternalMembersQuery: () => mockUseGetExternalMembersQuery(),
  useInviteExternalMemberMutation: () => [
    mockInviteExternalMember,
    { isLoading: false },
  ],
}))

function makeMember(overrides = {}) {
  return {
    id: "ext-1",
    organizationId: "org-42",
    email: "reviewer@partnerfirm.com",
    fullName: "Reviewer One",
    role: "LIGHT_USER",
    isActive: true,
    isExpired: false,
    expiresAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("ExternalMembersSection", () => {
  beforeEach(() => {
    mockInviteExternalMember.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseGetExternalMembersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
  })

  // `@testing-library/user-event`'s own setup() installs its own clipboard
  // polyfill (for copy/paste event support), overwriting anything installed
  // beforehand -- so the mock has to be (re-)applied AFTER userEvent.setup()
  // in each test that needs it, not once in beforeEach.
  function mockClipboardWriteText() {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    return writeText
  }

  it("shows the empty state when there are no external members", () => {
    render(<ExternalMembersSection />)
    expect(
      screen.getByText("organization.externalMembers.noMembers")
    ).toBeInTheDocument()
  })

  it("renders an external member row", () => {
    mockUseGetExternalMembersQuery.mockReturnValue({
      data: { data: [makeMember()] },
      isLoading: false,
    })
    render(<ExternalMembersSection />)

    expect(screen.getByText("Reviewer One")).toBeInTheDocument()
    expect(screen.getByText("reviewer@partnerfirm.com")).toBeInTheDocument()
  })

  it("copies the org's /external-login/:organizationId link to the clipboard", async () => {
    const user = userEvent.setup()
    const writeText = mockClipboardWriteText()
    mockUseGetExternalMembersQuery.mockReturnValue({
      data: { data: [makeMember({ organizationId: "org-42" })] },
      isLoading: false,
    })
    render(<ExternalMembersSection />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.copyLink",
      })
    )

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/external-login/org-42")
      )
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("invites a new external member with the typed email and optional name", async () => {
    const user = userEvent.setup()
    mockInviteExternalMember.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    render(<ExternalMembersSection />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.inviteButton",
      })
    )
    await user.type(
      screen.getByPlaceholderText("organization.externalMembers.emailPlaceholder"),
      "new.reviewer@partnerfirm.com"
    )
    await user.type(screen.getByPlaceholderText("organization.externalMembers.namePlaceholder"), "New Reviewer")
    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.sendInvite",
      })
    )

    await waitFor(() =>
      expect(mockInviteExternalMember).toHaveBeenCalledWith({
        email: "new.reviewer@partnerfirm.com",
        fullName: "New Reviewer",
      })
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("sends fullName as undefined (not empty string) when left blank", async () => {
    const user = userEvent.setup()
    mockInviteExternalMember.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    render(<ExternalMembersSection />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.inviteButton",
      })
    )
    await user.type(
      screen.getByPlaceholderText("organization.externalMembers.emailPlaceholder"),
      "new.reviewer@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.sendInvite",
      })
    )

    await waitFor(() =>
      expect(mockInviteExternalMember).toHaveBeenCalledWith({
        email: "new.reviewer@partnerfirm.com",
        fullName: undefined,
      })
    )
  })

  it("shows an error toast when invite fails", async () => {
    const user = userEvent.setup()
    mockInviteExternalMember.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "This email is already an external member of your organization." },
        }),
    })
    render(<ExternalMembersSection />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.inviteButton",
      })
    )
    await user.type(
      screen.getByPlaceholderText("organization.externalMembers.emailPlaceholder"),
      "dup@partnerfirm.com"
    )
    await user.click(
      screen.getByRole("button", {
        name: "organization.externalMembers.sendInvite",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "This email is already an external member of your organization."
      )
    )
  })
})
