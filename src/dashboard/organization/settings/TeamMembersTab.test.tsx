import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import TeamMembersTab from "./TeamMembersTab"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { toast } from "sonner"

// Controllable `i18n.language` for the locale-formatting test below, while
// every other test in this file keeps relying on the real (uninitialized)
// react-i18next t(), which just echoes the raw key back -- same technique
// as CorrelationMatrixPage.test.tsx. Defaults to unset, matching the real
// uninitialized instance's behavior the other tests already assume.
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

// aexa-frontend#239 -- role hook mocked per-test via this mutable holder,
// same convention as RiskRegisterPage.test.tsx / RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))
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

// aexa-frontend#216 -- has its own dedicated RTK Query hooks and test file
// (ExternalMembersSection.test.tsx); mocked as a black box here so this
// suite's existing assertions about the internal-member table aren't
// coupled to it, same pattern FindingDetails.test.tsx uses for
// CreateNewFindingModal.
vi.mock("./ExternalMembersSection", () => ({
  default: () => <div data-testid="external-members-section" />,
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
    mockRole = "ADMIN"
    mockLanguage = undefined
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

  // aexa-frontend#464 -- this section heading (and the "Pending invitations"
  // sub-heading below) used to be <h3>/<h4>, skipping straight from
  // OrgSettingPage's <h1> with no <h2> in between (Team is the first section
  // rendered in that tab).
  it("renders the section heading as an h2 and pending-invitations as an h3", () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetPendingInvitationsQuery.mockReturnValue(
      pendingInvitationForExpiry()
    )

    render(<TeamMembersTab />)

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.teamMembers.heading",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "organization.teamMembers.pendingInvitations",
      })
    ).toBeInTheDocument()
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

  // type=button sweep finding: 3 non-submit buttons (Invite Member trigger,
  // per-member suspend/reactivate, per-invitation resend) had no explicit
  // type, defaulting to type="submit" -- a real footgun since this file
  // also renders a real <form> (the invite dialog), whose own Cancel/Submit
  // buttons already declared their type correctly. Full sweep since this
  // file has no shadcn <Button> usage; mounts a member + a pending
  // invitation + the open invite dialog so every button renders.
  it("gives every non-submit button an explicit type=\"button\"", async () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [member()] },
      isLoading: false,
    })
    mockUseGetPendingInvitationsQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "inv-1",
            email: "pending@test.com",
            role: "VIEWER",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    })

    render(<TeamMembersTab />)
    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.inviteMember" })
    )

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      const isRealSubmit = button.textContent?.includes(
        "organization.teamMembers.sendInvitation"
      )
      expect(button.type).toBe(isRealSubmit ? "submit" : "button")
    })
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
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.getByText("organization.teamMembers.pendingInvitations")).toBeInTheDocument()
    expect(screen.getByText("pending@test.com")).toBeInTheDocument()
  })

  function pendingInvitationForExpiry() {
    return {
      data: {
        data: [
          {
            id: "inv-1",
            email: "pending@test.com",
            role: "VIEWER",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    }
  }

  // Regression: the expiry date used to call toLocaleDateString() with no
  // locale argument, so it always rendered US format (M/D/YYYY) even under
  // the French locale. It now passes an explicit locale derived from
  // i18n.language. With i18n.language unset (the default in this file's
  // mock, matching the real uninitialized instance's behavior other tests
  // here assume), the component falls back to "en-US" -- this asserts a
  // locale string is always passed through, not that a specific locale wins.
  it("formats the invitation expiry date with an explicit locale argument, not the no-arg overload", () => {
    const localeDateSpy = vi.spyOn(Date.prototype, "toLocaleDateString")
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetPendingInvitationsQuery.mockReturnValue(
      pendingInvitationForExpiry()
    )

    render(<TeamMembersTab />)

    expect(localeDateSpy).toHaveBeenCalledWith(
      expect.any(String),
      undefined
    )
    localeDateSpy.mockRestore()
  })

  // Regression (review round 1): a strict `i18n.language === "fr"` check
  // silently fell through to US formatting whenever i18next-browser-
  // languagedetector populated i18n.language with a full browser locale tag
  // (e.g. "fr-FR", "fr-CA") instead of the bare "fr" -- which it does by
  // default before the user ever touches the language switcher (detection
  // order: localStorage, then navigator; see src/i18n/i18n.ts). Fixed to use
  // the same `.startsWith("fr")` check already established in
  // LanguageSwitcher.tsx. These two cases assert the fr-FR locale is
  // actually selected, not just that some locale string is passed.
  it.each([["fr"], ["fr-FR"], ["fr-CA"]])(
    "selects the fr-FR date locale when i18n.language is %s",
    (language) => {
      mockLanguage = language
      const localeDateSpy = vi.spyOn(Date.prototype, "toLocaleDateString")
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue(
        pendingInvitationForExpiry()
      )

      render(<TeamMembersTab />)

      expect(localeDateSpy).toHaveBeenCalledWith("fr-FR", undefined)
      localeDateSpy.mockRestore()
    }
  )

  it("selects the en-US date locale when i18n.language is English", () => {
    mockLanguage = "en-US"
    const localeDateSpy = vi.spyOn(Date.prototype, "toLocaleDateString")
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetPendingInvitationsQuery.mockReturnValue(
      pendingInvitationForExpiry()
    )

    render(<TeamMembersTab />)

    expect(localeDateSpy).toHaveBeenCalledWith("en-US", undefined)
    localeDateSpy.mockRestore()
  })

  // Regression (aexa-frontend#492): the invite dialog's email input and role
  // select had labels with no htmlFor/id association, so a screen reader or
  // getByLabelText couldn't connect the visible label text to its control.
  it("associates the invite dialog's email and role labels with their inputs", async () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.inviteMember" })
    )

    expect(
      screen.getByLabelText("organization.teamMembers.emailLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.teamMembers.roleLabel")
    ).toBeInTheDocument()
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

  // aexa-frontend#464 -- the invite modal used to be a hand-rolled overlay
  // div with no dialog semantics or focus trap. It now goes through the
  // shared Radix-backed Dialog (src/components/ui/dialog.tsx). Asserts both
  // role="dialog" (review round 1: a prior version of this test claimed to
  // prove aria-modal/focus-trap but only checked role) AND that focus
  // actually moved inside the dialog on open, which is the real,
  // observable behavior a focus trap provides.
  it("opens the invite form as an accessible dialog with focus moved inside it", async () => {
    mockUseGetAllOrgUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<TeamMembersTab />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: "organization.teamMembers.inviteMember" })
    )

    // role="dialog" only exists on Radix's Dialog.Content -- getByRole
    // succeeding here proves the modal now goes through the shared Dialog
    // primitive instead of a hand-rolled overlay div.
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    // Radix's focus trap auto-focuses the first focusable element inside
    // the dialog on open -- this is the actual, testable effect of the
    // focus trap (rather than asserting on an aria-modal attribute Radix's
    // Dialog.Content doesn't set in this version).
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(
      screen.getByRole("heading", {
        name: "organization.teamMembers.inviteTeamMember",
      })
    ).toBeInTheDocument()
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
        expiresAt: "2099-01-01T00:00:00.000Z",
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

    // Regression (round 3 audit): an already-expired invitation rendered
    // identically to a live pending one -- no badge, and a "Resend" button
    // that looked exactly as actionable as a non-expired invite's. Derived
    // from expiresAt the same way the "Expires" column already formats it,
    // since invitations (unlike members) don't carry a precomputed
    // isExpired flag from the API.
    it("shows an Expired badge and relabels Resend for an already-expired invitation", () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: {
          data: [pendingInvitation({ expiresAt: "2020-01-01T00:00:00.000Z" })],
        },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(
        screen.getByText("organization.teamMembers.statusExpired")
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "organization.teamMembers.resendExpired",
        })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "organization.teamMembers.resend" })
      ).not.toBeInTheDocument()
    })

    it("does not show an Expired badge for a still-live invitation", () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: {
          data: [pendingInvitation({ expiresAt: "2099-01-01T00:00:00.000Z" })],
        },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(
        screen.queryByText("organization.teamMembers.statusExpired")
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "organization.teamMembers.resend" })
      ).toBeInTheDocument()
    })

    it("can still resend an already-expired invitation", async () => {
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: {
          data: [pendingInvitation({ expiresAt: "2020-01-01T00:00:00.000Z" })],
        },
        isLoading: false,
      })
      mockResendInvitation.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(<TeamMembersTab />)
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.teamMembers.resendExpired",
        })
      )

      await waitFor(() =>
        expect(mockResendInvitation).toHaveBeenCalledWith("inv-1")
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

  describe("role gating (aexa-frontend#239)", () => {
    it("shows Invite member and Suspend/Resend controls for an ADMIN", () => {
      mockRole = "ADMIN"
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member()] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: {
          data: [
            {
              id: "inv-1",
              email: "pending@test.com",
              role: "VIEWER",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(
        screen.getByRole("button", {
          name: "organization.teamMembers.inviteMember",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "organization.teamMembers.suspend" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "organization.teamMembers.resend" })
      ).toBeInTheDocument()
    })

    it("hides Invite member and Suspend/Resend controls for a VIEWER", () => {
      mockRole = "VIEWER"
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member()] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: {
          data: [
            {
              id: "inv-1",
              email: "pending@test.com",
              role: "VIEWER",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(
        screen.queryByRole("button", {
          name: "organization.teamMembers.inviteMember",
        })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "organization.teamMembers.suspend" })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "organization.teamMembers.resend" })
      ).not.toBeInTheDocument()
    })

    it("hides Invite member and Suspend/Resend controls for a LIGHT_USER", () => {
      mockRole = "LIGHT_USER"
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member()] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(
        screen.queryByRole("button", {
          name: "organization.teamMembers.inviteMember",
        })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "organization.teamMembers.suspend" })
      ).not.toBeInTheDocument()
    })

    it("still shows read-only member/status/role info for a VIEWER", () => {
      mockRole = "VIEWER"
      mockUseGetAllOrgUsersQuery.mockReturnValue({
        data: { data: [member()] },
        isLoading: false,
      })
      mockUseGetPendingInvitationsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      render(<TeamMembersTab />)

      expect(screen.getByText("Auditor One")).toBeInTheDocument()
      expect(screen.getByText("auditor@test.com")).toBeInTheDocument()
    })
  })
})
