import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import TeamMembersTab from "./TeamMembersTab"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllOrgUsersQuery = vi.fn()
const mockUseGetPendingInvitationsQuery = vi.fn()
const mockInviteMember = vi.fn()
const mockUpdateOrgMember = vi.fn()
const mockResendInvitation = vi.fn()

vi.mock("@/redux/apis/organization/org.user.api", () => ({
  useGetAllOrgUsersQuery: (...args: unknown[]) =>
    mockUseGetAllOrgUsersQuery(...args),
  useGetPendingInvitationsQuery: (...args: unknown[]) =>
    mockUseGetPendingInvitationsQuery(...args),
  useInviteMemberMutation: () => [mockInviteMember, { isLoading: false }],
  useUpdateOrgMemberMutation: () => [mockUpdateOrgMember, { isLoading: false }],
  useResendInvitationMutation: () => [
    mockResendInvitation,
    { isLoading: false },
  ],
}))

function member(overrides = {}) {
  return {
    id: "member-1",
    role: "LEAD_AUDITOR",
    status: "ACTIVE",
    isExpired: false,
    account: { email: "auditor@test.com", profile: { fullName: "Auditor One" } },
    ...overrides,
  }
}

describe("TeamMembersTab", () => {
  beforeEach(() => {
    mockInviteMember.mockReset()
    mockUpdateOrgMember.mockReset()
    mockResendInvitation.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseGetPendingInvitationsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
  })

  it("renders member name, email, role, and status", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [member()] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("Auditor One")).toBeInTheDocument()
    expect(screen.getByText("auditor@test.com")).toBeInTheDocument()
    expect(screen.getByText("organization.teamMembers.roleLeadAuditor")).toBeInTheDocument()
    expect(screen.getByText("organization.teamMembers.statusActive")).toBeInTheDocument()
  })

  it("shows a suspended member as Suspended, not Active", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [member({ status: "SUSPENDED" })] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("organization.teamMembers.statusSuspended")).toBeInTheDocument()
    expect(screen.queryByText("organization.teamMembers.statusActive")).not.toBeInTheDocument()
  })

  it("shows an expired member as Expired even if status is still ACTIVE", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [member({ status: "ACTIVE", isExpired: true })] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("organization.teamMembers.statusExpired")).toBeInTheDocument()
  })

  it("falls back to an em dash when a member has no fullName set", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: {
        data: [member({ account: { email: "noname@test.com" } })],
      },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("noname@test.com")).toBeInTheDocument()
  })

  it("shows pending invitations in a separate section", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetPendingInvitationsQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "inv-1",
            email: "pending@test.com",
            role: "VIEWER",
            expiresAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("organization.teamMembers.pendingInvitations")).toBeInTheDocument()
    expect(screen.getByText("pending@test.com")).toBeInTheDocument()
  })

  it("does not render the pending invitations section when there are none", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.queryByText("organization.teamMembers.pendingInvitations")).not.toBeInTheDocument()
  })

  it("submits an invite with email and role, shows a success toast, and closes the form", async () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockInviteMember.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<TeamMembersTab />)

    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.inviteMember" })
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.teamMembers.emailPlaceholder"),
      "newperson@test.com"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.sendInvitation" })
    )

    await waitFor(() => expect(mockInviteMember).toHaveBeenCalledWith({
      email: "newperson@test.com",
      role: "LEAD_AUDITOR",
    }))
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    expect(
      screen.queryByRole("button", { name: "organization.teamMembers.sendInvitation" })
    ).not.toBeInTheDocument()
  })

  it("shows the server's error message on a failed invite (e.g. non-admin caller gets a 403) instead of a generic toast", async () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockInviteMember.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Only organization admins can manage invitations." },
        }),
    })

    render(<TeamMembersTab />)

    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.inviteMember" })
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.teamMembers.emailPlaceholder"),
      "newperson@test.com"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.sendInvitation" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Only organization admins can manage invitations."
      )
    )
  })

  it("does not submit when the email field is empty", async () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.inviteMember" })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.sendInvitation" })
    )

    expect(screen.getByText("organization.teamMembers.emailRequired")).toBeInTheDocument()
    expect(mockInviteMember).not.toHaveBeenCalled()
  })

  it("shows an error state when the member list fails to load", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("organization.teamMembers.loadFailed")).toBeInTheDocument()
  })

  describe("suspend/reactivate", () => {
    it("suspends an active member and shows a success toast", async () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member()] },
        isLoading: false,
      })
      mockUpdateOrgMember.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(<TeamMembersTab />)
      await userEvent.click(screen.getByRole("button", { name: "organization.teamMembers.suspend" }))

      await waitFor(() =>
        expect(mockUpdateOrgMember).toHaveBeenCalledWith({
          id: "member-1",
          body: { status: "SUSPENDED" },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("organization.teamMembers.memberSuspended")
    })

    it("reactivates a suspended (non-expired) member", async () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member({ status: "SUSPENDED" })] },
        isLoading: false,
      })
      mockUpdateOrgMember.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(<TeamMembersTab />)
      await userEvent.click(screen.getByRole("button", { name: "organization.teamMembers.reactivate" }))

      await waitFor(() =>
        expect(mockUpdateOrgMember).toHaveBeenCalledWith({
          id: "member-1",
          body: { status: "ACTIVE" },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("organization.teamMembers.memberReactivated")
    })

    it("disables reactivate for a suspended member whose access window has also expired", () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: {
          data: [member({ status: "SUSPENDED", isExpired: true })],
        },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(screen.getByRole("button", { name: "organization.teamMembers.reactivate" })).toBeDisabled()
      expect(mockUpdateOrgMember).not.toHaveBeenCalled()
    })

    it("shows the server's error message when suspending fails (e.g. non-admin caller)", async () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member()] },
        isLoading: false,
      })
      mockUpdateOrgMember.mockReturnValue({
        unwrap: () =>
          Promise.reject({
            data: { message: "Only organization admins can manage invitations." },
          }),
      })

      render(<TeamMembersTab />)
      await userEvent.click(screen.getByRole("button", { name: "organization.teamMembers.suspend" }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          "Only organization admins can manage invitations."
        )
      )
    })
  })

  describe("resend invitation", () => {
    function pendingInvitation(overrides = {}) {
      return {
        id: "inv-1",
        email: "pending@test.com",
        role: "VIEWER",
        expiresAt: "2026-08-01T00:00:00.000Z",
        ...overrides,
      }
    }

    it("resends an invitation and shows a success toast", async () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: { data: [pendingInvitation()] },
        isLoading: false,
      })
      mockResendInvitation.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(<TeamMembersTab />)
      await userEvent.click(screen.getByRole("button", { name: "organization.teamMembers.resend" }))

      await waitFor(() =>
        expect(mockResendInvitation).toHaveBeenCalledWith("inv-1")
      )
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.teamMembers.invitationResent"
      )
    })

    it("shows an error toast when resend fails", async () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: { data: [pendingInvitation()] },
        isLoading: false,
      })
      mockResendInvitation.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "Only pending invitations can be resent." } }),
      })

      render(<TeamMembersTab />)
      await userEvent.click(screen.getByRole("button", { name: "organization.teamMembers.resend" }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          "Only pending invitations can be resent."
        )
      )
    })
  })
})
