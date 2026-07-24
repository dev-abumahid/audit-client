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

      await waitFor(() =>
        expect(mockSubmit).toHaveBeenCalledWith("risk-1")
      )
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
      await userEvent.type(
        screen.getByPlaceholderText(
          "organization.riskRegister.approval.rejectReasonPlaceholder"
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
        unwrap: () =>
          Promise.reject({ data: { message: "already pending" } }),
      })

      render(<RiskApprovalControls risk={makeRisk("NOT_SUBMITTED", null)} />)
      await userEvent.click(screen.getByRole("button", { name: SUBMIT }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("already pending")
      )
    })
  })
})
