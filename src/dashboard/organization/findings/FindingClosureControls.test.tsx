import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { IAction } from "@/types/finding"
import FindingClosureControls from "./FindingClosureControls"

// Controllable `i18n.language` for the locale-formatting test below. `t()`
// itself just echoes the raw key back in this uninitialized test environment
// (see RiskRegisterPage.test.tsx for the same convention), which would
// normally swallow the interpolated `date` param on the "decidedOn" key --
// special-case just that one key to append its params so the locale-
// formatted date value is still assertable, without a real i18next instance.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return {
        ...real,
        t: (key: string, params?: Record<string, unknown>) =>
          key === "organization.findings.closure.decidedOn" && params
            ? `${key}::${JSON.stringify(params)}`
            : real.t(key),
        i18n: { ...real.i18n, language: mockLanguage },
      }
    },
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

// aexa-frontend#270: `undefined` (the default here) means "assignment data
// unavailable" -- FindingClosureControls degrades LIGHT_USER's canSubmit to
// `true` in that case (its own pre-#270 default, see canWriteFinding's
// `lightUserDegradeDefault` param), which is exactly what the pre-existing
// "LIGHT_USER sees submit controls" test below already expects without
// having to know about assignment data at all.
let mockAssignedInspectionIds: Set<string> | undefined = undefined
let mockActiveFindingAssignmentIds: Set<string> | undefined = undefined
vi.mock("@/hooks/useMyAssignments", () => ({
  useMyAssignedInspectionIds: () => mockAssignedInspectionIds,
  useMyActiveFindingAssignmentIds: () => mockActiveFindingAssignmentIds,
}))

let mockMyAccountId = "acc-2"
let mockMeLoading = false
vi.mock("@/redux/apis/auth.api", () => ({
  useGetMeQuery: () => ({
    data: mockMeLoading ? undefined : { data: { id: mockMyAccountId } },
    isLoading: mockMeLoading,
  }),
}))

const mockUseGetFindingClosureStateQuery = vi.fn()
const mockSubmit = vi.fn()
const mockApprove = vi.fn()
const mockReject = vi.fn()
vi.mock("@/redux/apis/organization/findingClosure.api", () => ({
  useGetFindingClosureStateQuery: (...args: unknown[]) =>
    mockUseGetFindingClosureStateQuery(...args),
  useSubmitFindingForClosureMutation: () => [mockSubmit, { isLoading: false }],
  useApproveFindingClosureMutation: () => [mockApprove, { isLoading: false }],
  useRejectFindingClosureMutation: () => [mockReject, { isLoading: false }],
}))

const SUBMIT_COMPLETE = "organization.findings.closure.submitComplete"
const SUBMIT_CANT_DO = "organization.findings.closure.submitCantDo"
const APPROVE = "organization.findings.closure.approve"
const REJECT = "organization.findings.closure.reject"

function makeAction(overrides: Partial<IAction> = {}): IAction {
  return {
    id: "finding-1",
    orgAccountId: "org-1",
    inspectionId: "insp-1",
    actionTitle: "Fix broken railing",
    priority: "High",
    dueDate: "2099-07-01T00:00:00.000Z",
    status: "TO_DO",
    attachments: ["https://cdn.example.com/evidence.pdf"],
    messages: [],
    assignBy: [],
    line_of_defense: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as IAction
}

function makeClosure(
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED",
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "closure-1",
    actionId: "finding-1",
    status,
    requestedStatus: "COMPLETE",
    submittedById: "acc-1",
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    invalidatedAt: null,
    invalidatedById: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

function mockClosureState(
  status: "NOT_SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED",
  closure: ReturnType<typeof makeClosure> | null = null
) {
  mockUseGetFindingClosureStateQuery.mockReturnValue({
    data: { data: { actionId: "finding-1", status, closure } },
    isLoading: false,
  })
}

describe("FindingClosureControls", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockRole = "ADMIN"
    mockMyAccountId = "acc-2"
    mockMeLoading = false
    mockSubmit.mockReset()
    mockApprove.mockReset()
    mockReject.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
    mockUseGetFindingClosureStateQuery.mockReset()
    mockClosureState("NOT_SUBMITTED")
    mockAssignedInspectionIds = undefined
    mockActiveFindingAssignmentIds = undefined
  })

  it("renders nothing while the closure state is loading", () => {
    mockUseGetFindingClosureStateQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    const { container } = render(
      <FindingClosureControls action={makeAction()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the correct badge for each display state", () => {
    mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
    const { rerender } = render(
      <FindingClosureControls action={makeAction()} />
    )
    expect(
      screen.getByText("organization.findings.closure.badgePending")
    ).toBeInTheDocument()

    mockClosureState("APPROVED", makeClosure("APPROVED"))
    rerender(<FindingClosureControls action={makeAction()} />)
    expect(
      screen.getByText("organization.findings.closure.badgeApproved")
    ).toBeInTheDocument()

    mockClosureState("NOT_SUBMITTED")
    rerender(<FindingClosureControls action={makeAction()} />)
    expect(
      screen.getByText("organization.findings.closure.badgeNotSubmitted")
    ).toBeInTheDocument()
  })

  describe("evidence gate", () => {
    it("disables both submit buttons and shows a hint when there are no attachments", () => {
      render(
        <FindingClosureControls action={makeAction({ attachments: [] })} />
      )
      expect(screen.getByRole("button", { name: SUBMIT_COMPLETE })).toBeDisabled()
      expect(screen.getByRole("button", { name: SUBMIT_CANT_DO })).toBeDisabled()
      expect(
        screen.getByText("organization.findings.closure.evidenceRequired")
      ).toBeInTheDocument()
    })

    it("enables submit buttons and hides the hint once at least one attachment exists", () => {
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.getByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeDisabled()
      expect(
        screen.queryByText("organization.findings.closure.evidenceRequired")
      ).not.toBeInTheDocument()
    })
  })

  describe("closed findings", () => {
    it("shows no submit controls once the finding is already COMPLETE", () => {
      render(
        <FindingClosureControls action={makeAction({ status: "COMPLETE" })} />
      )
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: SUBMIT_CANT_DO })
      ).not.toBeInTheDocument()
    })

    it("shows no submit controls once the finding is already CANT_DO", () => {
      render(
        <FindingClosureControls action={makeAction({ status: "CANT_DO" })} />
      )
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
    })
  })

  describe("role gating", () => {
    it("LIGHT_USER sees submit controls on a not-submitted finding (may hold a FindingAssignment)", () => {
      mockRole = "LIGHT_USER"
      render(<FindingClosureControls action={makeAction()} />)
      expect(screen.getByRole("button", { name: SUBMIT_COMPLETE })).toBeInTheDocument()
    })

    it("VIEWER sees no submit controls", () => {
      mockRole = "VIEWER"
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
    })

    it("LEAD_AUDITOR sees Approve/Reject on a pending closure, but no submit controls", () => {
      mockRole = "LEAD_AUDITOR"
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)
      expect(screen.getByRole("button", { name: APPROVE })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: REJECT })).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
    })

    it("LIGHT_USER does not see Approve/Reject even on a pending closure", () => {
      mockRole = "LIGHT_USER"
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
    })

    // Server-side self-approval guard (action.closure.service.ts) already
    // blocks this with a 403 -- mirrors RiskApprovalControls' equivalent
    // protection so the submitter never sees a dead-end button.
    it("the submitter does NOT see Approve/Reject, sees the awaiting-reviewer message instead", () => {
      mockRole = "ADMIN"
      mockMyAccountId = "acc-1" // matches makeClosure's default submittedById
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)

      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText("organization.findings.closure.awaitingOtherReviewer")
      ).toBeInTheDocument()
    })

    it("a non-submitting reviewer still sees Approve/Reject", () => {
      mockRole = "ADMIN"
      mockMyAccountId = "acc-2" // does not match submittedById "acc-1"
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)

      expect(screen.getByRole("button", { name: APPROVE })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: REJECT })).toBeInTheDocument()
    })

    it("shows neither decide buttons nor the awaiting-reviewer message while `me` is still loading", () => {
      mockRole = "ADMIN"
      mockMeLoading = true
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)

      expect(
        screen.queryByRole("button", { name: APPROVE })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText("organization.findings.closure.awaitingOtherReviewer")
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#270: canSubmit narrows LEAD_AUDITOR/LIGHT_USER's role-only
  // gate above by real InspectionAssignment/FindingAssignment state
  // (mirrors org_scope.ts's assertCanWriteToAction).
  describe("assignment gating (#270)", () => {
    it("hides submit controls for a LIGHT_USER with a revoked FindingAssignment", () => {
      mockRole = "LIGHT_USER"
      mockActiveFindingAssignmentIds = new Set() // known empty, not "unavailable"
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
    })

    it("shows submit controls for a LIGHT_USER with an active FindingAssignment on this exact finding", () => {
      mockRole = "LIGHT_USER"
      mockActiveFindingAssignmentIds = new Set(["finding-1"])
      render(<FindingClosureControls action={makeAction()} />)
      expect(screen.getByRole("button", { name: SUBMIT_COMPLETE })).toBeInTheDocument()
    })

    it("hides submit controls for a LIGHT_USER assigned to a DIFFERENT finding", () => {
      mockRole = "LIGHT_USER"
      mockActiveFindingAssignmentIds = new Set(["some-other-finding"])
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
    })

    it("hides submit controls for an unassigned LEAD_AUDITOR (known assignment data)", () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set()
      render(<FindingClosureControls action={makeAction({ inspectionId: "insp-1" })} />)
      expect(
        screen.queryByRole("button", { name: SUBMIT_COMPLETE })
      ).not.toBeInTheDocument()
    })

    it("shows submit controls for a LEAD_AUDITOR assigned to the finding's parent inspection", () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set(["insp-1"])
      render(<FindingClosureControls action={makeAction({ inspectionId: "insp-1" })} />)
      expect(screen.getByRole("button", { name: SUBMIT_COMPLETE })).toBeInTheDocument()
    })

    it("degrades LIGHT_USER back to the pre-#270 default (allowed) when assignment data is unavailable", () => {
      mockRole = "LIGHT_USER"
      mockActiveFindingAssignmentIds = undefined
      render(<FindingClosureControls action={makeAction()} />)
      expect(screen.getByRole("button", { name: SUBMIT_COMPLETE })).toBeInTheDocument()
    })
  })

  describe("actions", () => {
    it("submits with requestedStatus COMPLETE when that button is clicked", async () => {
      mockSubmit.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
      render(<FindingClosureControls action={makeAction()} />)

      await userEvent.click(screen.getByRole("button", { name: SUBMIT_COMPLETE }))

      await waitFor(() =>
        expect(mockSubmit).toHaveBeenCalledWith({
          actionId: "finding-1",
          requestedStatus: "COMPLETE",
        })
      )
      expect(mockToastSuccess).toHaveBeenCalled()
    })

    it("submits with requestedStatus CANT_DO when that button is clicked", async () => {
      mockSubmit.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
      render(<FindingClosureControls action={makeAction()} />)

      await userEvent.click(screen.getByRole("button", { name: SUBMIT_CANT_DO }))

      await waitFor(() =>
        expect(mockSubmit).toHaveBeenCalledWith({
          actionId: "finding-1",
          requestedStatus: "CANT_DO",
        })
      )
    })

    it("Approve calls approveClosure with the closure id", async () => {
      mockApprove.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
      mockMyAccountId = "acc-2"
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)

      await userEvent.click(screen.getByRole("button", { name: APPROVE }))

      await waitFor(() => expect(mockApprove).toHaveBeenCalledWith("closure-1"))
    })

    it("Reject requires a reason before calling rejectClosure", async () => {
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)

      await userEvent.click(screen.getByRole("button", { name: REJECT }))
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.closure.rejectConfirm",
        })
      )

      expect(mockToastError).toHaveBeenCalledWith(
        "organization.findings.closure.rejectReasonRequired"
      )
      expect(mockReject).not.toHaveBeenCalled()
    })

    it("Reject calls rejectClosure with the closure id and decision note", async () => {
      mockReject.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)

      await userEvent.click(screen.getByRole("button", { name: REJECT }))
      await userEvent.type(
        screen.getByPlaceholderText(
          "organization.findings.closure.rejectReasonPlaceholder"
        ),
        "Evidence insufficient"
      )
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.closure.rejectConfirm",
        })
      )

      await waitFor(() =>
        expect(mockReject).toHaveBeenCalledWith({
          closureId: "closure-1",
          decisionNote: "Evidence insufficient",
        })
      )
    })

    it("shows an error toast when submit fails", async () => {
      mockSubmit.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: "already pending" } }),
      })
      render(<FindingClosureControls action={makeAction()} />)

      await userEvent.click(screen.getByRole("button", { name: SUBMIT_COMPLETE }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("already pending")
      )
    })
  })

  describe("audit trail display", () => {
    it("shows the rejection reason when rejected with a decision note", () => {
      mockClosureState(
        "REJECTED",
        makeClosure("REJECTED", { decisionNote: "Evidence insufficient" })
      )
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.getByText("organization.findings.closure.rejectionReason")
      ).toBeInTheDocument()
    })

    it("does not show a rejection reason while pending (no decision yet)", () => {
      mockClosureState("PENDING_APPROVAL", makeClosure("PENDING_APPROVAL"))
      render(<FindingClosureControls action={makeAction()} />)
      expect(
        screen.queryByText(/organization\.findings\.closure\.rejectionReason/)
      ).not.toBeInTheDocument()
    })

    // aexa-frontend#378: the "decided on" date used a bare
    // toLocaleDateString() with no locale, always showing English month
    // names under a French UI.
    it("formats the decided-on date using the shared locale-aware helper", () => {
      mockLanguage = "fr-FR"
      mockClosureState(
        "APPROVED",
        makeClosure("APPROVED", { decidedAt: "2099-07-01T00:00:00.000Z" })
      )
      render(<FindingClosureControls action={makeAction()} />)

      const expectedFr = new Date(
        "2099-07-01T00:00:00.000Z"
      ).toLocaleDateString("fr-FR")
      expect(
        screen.getByText(
          (_, el) =>
            el?.tagName.toLowerCase() === "p" &&
            !!el.textContent?.includes(expectedFr)
        )
      ).toBeInTheDocument()
    })
  })
})
