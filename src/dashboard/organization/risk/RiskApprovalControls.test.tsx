import type { Risk, RiskApprovalDisplayState } from "@/types/organization"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RiskApprovalControls from "./RiskApprovalControls"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

// Role hook is mocked per-test via this mutable holder.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

// The current account's id, mocked per-test via this mutable holder. Default
// is a different account than makeRisk's default submittedById ("acc-1"), so
// existing tests (written before the self-approval guard existed) keep
// exercising the "not the submitter" path unless a test opts into "acc-1".
let mockMyAccountId = "acc-2"
let mockMeLoading = false
vi.mock("@/redux/apis/auth.api", () => ({
  useGetMeQuery: () => ({
    data: mockMeLoading ? undefined : { data: { id: mockMyAccountId } },
    isLoading: mockMeLoading,
  }),
}))

const mockSubmit = vi.fn()
const mockApprove = vi.fn()
const mockReject = vi.fn()
vi.mock("@/redux/apis/organization/riskApproval.api", () => ({
  useSubmitRiskForApprovalMutation: () => [mockSubmit, { isLoading: false }],
  useApproveRiskMutation: () => [mockApprove, { isLoading: false }],
  useRejectRiskMutation: () => [mockReject, { isLoading: false }],
}))

const SUBMIT = "organization.riskRegister.approval.submit"
const APPROVE = "organization.riskRegister.approval.approve"
const REJECT = "organization.riskRegister.approval.reject"

function makeRisk(
  status: RiskApprovalDisplayState,
  approvalId: string | null = "ra-1"
): Risk {
  return {
    id: "risk-1",
    approvalStatus: status,
    approval: approvalId
      ? {
          id: approvalId,
          riskId: "risk-1",
          status: status === "NOT_SUBMITTED" ? "REJECTED" : status,
          submittedById: "acc-1",
          decidedById: null,
          decidedAt: null,
          decisionNote: null,
          invalidatedAt: null,
          invalidatedById: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        }
      : null,
  } as unknown as Risk
}

describe("RiskApprovalControls", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockMyAccountId = "acc-2"
    mockMeLoading = false
    mockSubmit.mockReset()
    mockApprove.mockReset()
    mockReject.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
  })

  it("renders the correct badge for each display state", () => {
    const { rerender } = render(
      <RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />
    )
    expect(
      screen.getByText("organization.riskRegister.approval.badgePending")
    ).toBeInTheDocument()

    rerender(<RiskApprovalControls risk={makeRisk("APPROVED")} />)
    expect(
      screen.getByText("organization.riskRegister.approval.badgeApproved")
    ).toBeInTheDocument()

    rerender(<RiskApprovalControls risk={makeRisk("NOT_SUBMITTED", null)} />)
    expect(
      screen.getByText("organization.riskRegister.approval.badgeNotSubmitted")
    ).toBeInTheDocument()
  })

  it("defaults to NOT_SUBMITTED badge when approvalStatus is absent", () => {
    render(<RiskApprovalControls risk={{ id: "risk-1" } as Risk} />)
    expect(
      screen.getByText("organization.riskRegister.approval.badgeNotSubmitted")
    ).toBeInTheDocument()
  })

  describe("role gating", () => {
    it("LEAD_AUDITOR sees Submit on a not-submitted risk, but not Approve/Reject", () => {
      mockRole = "LEAD_AUDITOR"
      render(<RiskApprovalControls risk={makeRisk("NOT_SUBMITTED", null)} />)

      expect(screen.getByRole("button", { name: SUBMIT })).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT })
      ).not.toBeInTheDocument()
    })

    it("LEAD_AUDITOR can resubmit a REJECTED risk", () => {
      mockRole = "LEAD_AUDITOR"
      render(<RiskApprovalControls risk={makeRisk("REJECTED")} />)
      expect(screen.getByRole("button", { name: SUBMIT })).toBeInTheDocument()
    })

    it("ADMIN sees Approve and Reject on a pending risk, but no Submit", () => {
      mockRole = "ADMIN"
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)

      expect(screen.getByRole("button", { name: APPROVE })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: REJECT })).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: SUBMIT })
      ).not.toBeInTheDocument()
    })

    it("ADMIN does NOT see Approve/Reject on a non-pending risk", () => {
      mockRole = "ADMIN"
      render(<RiskApprovalControls risk={makeRisk("APPROVED")} />)
      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT })
      ).not.toBeInTheDocument()
    })

    // Server-side (risk.approval.service.ts) already blocks self-approval
    // with a 403 -- these prove the UI doesn't show a dead-end button to the
    // exact user the control is meant to protect (round-1 methodology audit
    // finding).
    it("ADMIN who submitted the risk does NOT see Approve/Reject, sees the awaiting-reviewer message instead", () => {
      mockRole = "ADMIN"
      mockMyAccountId = "acc-1" // matches makeRisk's default submittedById
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)

      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(
          "organization.riskRegister.approval.awaitingOtherReviewer"
        )
      ).toBeInTheDocument()
    })

    it("ADMIN who did NOT submit the risk still sees Approve/Reject", () => {
      mockRole = "ADMIN"
      mockMyAccountId = "acc-2" // does not match submittedById "acc-1"
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)

      expect(screen.getByRole("button", { name: APPROVE })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: REJECT })).toBeInTheDocument()
      expect(
        screen.queryByText(
          "organization.riskRegister.approval.awaitingOtherReviewer"
        )
      ).not.toBeInTheDocument()
    })

    // Round-2 review gap: isSubmitter used to default to `false` while
    // useGetMeQuery was still loading, so a genuine self-submitter would
    // briefly see the live (403-doomed) Approve/Reject buttons before `me`
    // resolved. Neither the buttons nor the "awaiting another admin"
    // message (a false claim for a real non-submitter reviewer) should
    // render until we can actually tell submitter and reviewer apart.
    it("shows neither the decide buttons nor the awaiting-reviewer message while the current account is still loading", () => {
      mockRole = "ADMIN"
      mockMeLoading = true
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)

      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(
          "organization.riskRegister.approval.awaitingOtherReviewer"
        )
      ).not.toBeInTheDocument()
    })

    it("VIEWER sees no action buttons at all", () => {
      mockRole = "VIEWER"
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)
      expect(
        screen.queryByRole("button", { name: SUBMIT })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT })
      ).not.toBeInTheDocument()
    })

    it("LIGHT_USER sees no action buttons", () => {
      mockRole = "LIGHT_USER"
      render(<RiskApprovalControls risk={makeRisk("NOT_SUBMITTED", null)} />)
      expect(
        screen.queryByRole("button", { name: SUBMIT })
      ).not.toBeInTheDocument()
    })

    it("renders no action buttons while the role is still loading (undefined)", () => {
      mockRole = undefined
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)
      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: SUBMIT })
      ).not.toBeInTheDocument()
    })
  })

  describe("actions", () => {
    it("Submit calls submitForApproval with the risk id", async () => {
      mockRole = "LEAD_AUDITOR"
      mockSubmit.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<RiskApprovalControls risk={makeRisk("NOT_SUBMITTED", null)} />)
      await userEvent.click(screen.getByRole("button", { name: SUBMIT }))

      await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith("risk-1"))
      expect(mockToastSuccess).toHaveBeenCalled()
    })

    it("Approve calls approveRisk with the approval id", async () => {
      mockRole = "ADMIN"
      mockApprove.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)
      await userEvent.click(screen.getByRole("button", { name: APPROVE }))

      await waitFor(() => expect(mockApprove).toHaveBeenCalledWith("ra-1"))
    })

    it("Reject requires a reason before calling rejectRisk", async () => {
      mockRole = "ADMIN"
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)

      await userEvent.click(screen.getByRole("button", { name: REJECT }))
      // Confirm with an empty reason -> validation toast, no API call.
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.approval.rejectConfirm",
        })
      )

      expect(mockToastError).toHaveBeenCalledWith(
        "organization.riskRegister.approval.rejectReasonRequired"
      )
      expect(mockReject).not.toHaveBeenCalled()
    })

    it("Reject calls rejectRisk with the approval id and decision note", async () => {
      mockRole = "ADMIN"
      mockReject.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)
      await userEvent.click(screen.getByRole("button", { name: REJECT }))
      // Round 13 (#505): the reason label now has a real htmlFor/id
      // association with the textarea, so this can go through
      // getByLabelText instead of routing around the gap via
      // getByPlaceholderText.
      await userEvent.type(
        screen.getByLabelText(
          "organization.riskRegister.approval.rejectReasonLabel"
        ),
        "Residual score too high"
      )
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.approval.rejectConfirm",
        })
      )

      await waitFor(() =>
        expect(mockReject).toHaveBeenCalledWith({
          approvalId: "ra-1",
          decisionNote: "Residual score too high",
        })
      )
    })

    it("shows an error toast when submit fails", async () => {
      mockRole = "LEAD_AUDITOR"
      mockSubmit.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: "already pending" } }),
      })

      render(<RiskApprovalControls risk={makeRisk("NOT_SUBMITTED", null)} />)
      await userEvent.click(screen.getByRole("button", { name: SUBMIT }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("already pending")
      )
    })
  })

  // Round-1 methodology audit finding: submittedById/decidedById/decisionNote
  // were already on the wire but nothing in the UI rendered them, so a
  // checker approved without seeing who made the submission, and a rejected
  // submitter never saw the reason anywhere in the product.
  describe("audit trail display", () => {
    it("shows the rejection reason when the risk was rejected with a decision note", () => {
      const risk = {
        id: "risk-1",
        approvalStatus: "REJECTED",
        approval: {
          id: "ra-1",
          riskId: "risk-1",
          status: "REJECTED",
          submittedById: "acc-1",
          decidedById: "acc-2",
          decidedAt: "2026-07-10T00:00:00.000Z",
          decisionNote: "Residual score too high",
          invalidatedAt: null,
          invalidatedById: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
      } as unknown as Risk
      render(<RiskApprovalControls risk={risk} />)

      // t() returns the raw key in this test environment (no i18n instance
      // initialized), so this only proves the rejection-reason element
      // rendered at all -- the interpolated {{reason}} value itself is
      // covered by the component reading risk.approval.decisionNote, not by
      // string-matching translated output.
      expect(
        screen.getByText("organization.riskRegister.approval.rejectionReason")
      ).toBeInTheDocument()
    })

    it("does not show a rejection reason when the risk is pending (no decision yet)", () => {
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)
      expect(
        screen.queryByText(/organization.riskRegister.approval.rejectionReason/)
      ).not.toBeInTheDocument()
    })

    // Regression guard (issue #342): decidedAt used to be formatted with a
    // bare `new Date(...).toLocaleDateString()` (no locale arg -- silently
    // formats in the visiting browser's locale rather than the app's
    // selected language). t() returns the raw key with no interpolation in
    // this test environment (see the comment above), so the formatted date
    // can't be asserted via rendered text -- instead this spies on the
    // shared formatLocaleDate() helper itself to prove the decidedOn date is
    // actually routed through it, not a bare toLocaleDateString() call.
    it("formats the decided-on date via the shared formatLocaleDate() helper", async () => {
      const formatDateModule = await import("@/utils/formatDate")
      const spy = vi.spyOn(formatDateModule, "formatLocaleDate")

      const risk = {
        id: "risk-1",
        approvalStatus: "APPROVED",
        approval: {
          id: "ra-1",
          riskId: "risk-1",
          status: "APPROVED",
          submittedById: "acc-1",
          decidedById: "acc-2",
          decidedAt: "2026-07-10T00:00:00.000Z",
          decisionNote: null,
          invalidatedAt: null,
          invalidatedById: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
      } as unknown as Risk
      render(<RiskApprovalControls risk={risk} />)

      // i18n isn't initialized in this test environment, so the language
      // arg is undefined here -- only the date value itself is asserted.
      expect(spy.mock.calls[0]?.[0]).toBe("2026-07-10T00:00:00.000Z")

      spy.mockRestore()
    })
  })

  // aexa-frontend#488 -- the Reject modal was a plain div with no
  // role="dialog", no aria-modal and no Escape handling, unlike KRI's
  // modals (round 10, #487).
  describe("modal accessibility", () => {
    it("marks the Reject modal as a labeled dialog and closes it on Escape", async () => {
      mockRole = "ADMIN"
      render(<RiskApprovalControls risk={makeRisk("PENDING_APPROVAL")} />)

      await userEvent.click(screen.getByRole("button", { name: REJECT }))
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")
      expect(dialog).toHaveAccessibleName(
        "organization.riskRegister.approval.rejectModalTitle"
      )

      await userEvent.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
