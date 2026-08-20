import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PendingAiReviewPanel from "./PendingAiReviewPanel"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

const mockUseGetAllRisksQuery = vi.fn()
const mockApproveRisk = vi.fn()
const mockDismissRisk = vi.fn()
const mockBulkApproveRisks = vi.fn()
const mockBulkDismissRisks = vi.fn()
let mockIsApproving = false
let mockIsDismissing = false

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useApproveRiskMutation: () => [
    mockApproveRisk,
    { isLoading: mockIsApproving },
  ],
  useDismissRiskMutation: () => [
    mockDismissRisk,
    { isLoading: mockIsDismissing },
  ],
  useBulkApproveRisksMutation: () => [
    mockBulkApproveRisks,
    { isLoading: false },
  ],
  useBulkDismissRisksMutation: () => [
    mockBulkDismissRisks,
    { isLoading: false },
  ],
}))

function makePendingRisk(overrides = {}) {
  return {
    id: "risk-1",
    name: "Uncontrolled anti-corruption exposure",
    category: "compliance",
    citation_confidence: "ai_estimate",
    ...overrides,
  }
}

// Mirrors real RTK Query behavior: a skipped query never returns data,
// regardless of what the caller passed as args -- so a test asserting on
// this mock's OWN skip handling (not just the component's post-fetch
// rendering) genuinely proves the lazy-fetch claim, the same way the real
// hook would.
function routeByReviewStatus(pending: unknown[], dismissed: unknown[] = []) {
  return (
    args: { reviewStatus?: string },
    options?: { skip?: boolean }
  ) => {
    if (options?.skip) {
      return { data: undefined, isLoading: false }
    }
    if (args.reviewStatus === "PENDING_REVIEW") {
      return { data: { data: pending }, isLoading: false }
    }
    if (args.reviewStatus === "DISMISSED") {
      return { data: { data: dismissed }, isLoading: false }
    }
    return { data: { data: [] }, isLoading: false }
  }
}

describe("PendingAiReviewPanel", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockApproveRisk.mockReset()
    mockDismissRisk.mockReset()
    mockBulkApproveRisks.mockReset()
    mockBulkDismissRisks.mockReset()
    mockIsApproving = false
    mockIsDismissing = false
    mockApproveRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: {} }),
    })
    mockDismissRisk.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: {
            risk: {},
            referencedBy: {
              kris: 0,
              complianceObligations: 0,
              auditEngagements: 0,
              riskLinks: 0,
            },
          },
        }),
    })
    mockBulkApproveRisks.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { updated: 1, skipped: 0 } }),
    })
    mockBulkDismissRisks.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, data: { updated: 1, skipped: 0 } }),
    })
  })

  it("shows nothing actionable and an empty message when there are no pending risks", () => {
    mockUseGetAllRisksQuery.mockImplementation(routeByReviewStatus([]))

    render(<PendingAiReviewPanel canWrite={true} />)

    expect(
      screen.getByText("organization.riskRegister.pendingReview.empty")
    ).toBeInTheDocument()
  })

  it("renders a pending risk with its citation-confidence badge and Approve/Dismiss actions", () => {
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([makePendingRisk()])
    )

    render(<PendingAiReviewPanel canWrite={true} />)

    expect(
      screen.getByText("Uncontrolled anti-corruption exposure")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "organization.riskRegister.citationConfidence.ai_estimate"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.approve",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.dismiss",
      })
    ).toBeInTheDocument()
  })

  it("hides Approve/Dismiss actions and the selection checkbox for a read-only viewer", () => {
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([makePendingRisk()])
    )

    render(<PendingAiReviewPanel canWrite={false} />)

    expect(
      screen.queryByRole("button", {
        name: "organization.riskRegister.pendingReview.approve",
      })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("calls approveRisk with the risk id when Approve is clicked", async () => {
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([makePendingRisk()])
    )

    render(<PendingAiReviewPanel canWrite={true} />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.approve",
      })
    )

    expect(mockApproveRisk).toHaveBeenCalledWith("risk-1")
  })

  it("calls dismissRisk and warns when the dismissed risk is still referenced elsewhere", async () => {
    mockDismissRisk.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          data: {
            risk: {},
            referencedBy: {
              kris: 2,
              complianceObligations: 0,
              auditEngagements: 1,
              riskLinks: 0,
            },
          },
        }),
    })
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([makePendingRisk()])
    )
    const { toast } = await import("sonner")

    render(<PendingAiReviewPanel canWrite={true} />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.dismiss",
      })
    )

    await waitFor(() => expect(mockDismissRisk).toHaveBeenCalledWith("risk-1"))
    expect(toast.warning).toHaveBeenCalled()
  })

  it("selecting rows shows the bulk action bar, and Approve all calls bulkApproveRisks with the selected ids", async () => {
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([
        makePendingRisk({ id: "risk-1", name: "Risk one" }),
        makePendingRisk({ id: "risk-2", name: "Risk two" }),
      ])
    )

    render(<PendingAiReviewPanel canWrite={true} />)
    const checkboxes = screen.getAllByRole("checkbox")
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])

    expect(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.approveAll",
      })
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.approveAll",
      })
    )

    expect(mockBulkApproveRisks).toHaveBeenCalledWith(["risk-1", "risk-2"])
  })

  // Round-1 review finding: a per-row action and a bulk action for the
  // same risk could otherwise fire concurrently (select a row, click its
  // own Approve, then immediately click "Approve all" while the first
  // request is still in flight).
  it("disables the bulk action buttons while a per-row approve/dismiss is in flight, and vice versa", async () => {
    mockIsApproving = true
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([
        makePendingRisk({ id: "risk-1", name: "Risk one" }),
        makePendingRisk({ id: "risk-2", name: "Risk two" }),
      ])
    )

    render(<PendingAiReviewPanel canWrite={true} />)
    const checkboxes = screen.getAllByRole("checkbox")
    await userEvent.click(checkboxes[0])

    expect(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.approveAll",
      })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.dismissAll",
      })
    ).toBeDisabled()
  })

  it("sorts pending risks by citation confidence ascending (least-confident first)", () => {
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus([
        makePendingRisk({
          id: "risk-verified",
          name: "Verified risk",
          citation_confidence: "curated_verified",
        }),
        makePendingRisk({
          id: "risk-none",
          name: "No citation risk",
          citation_confidence: "none",
        }),
        makePendingRisk({
          id: "risk-estimate",
          name: "Estimate risk",
          citation_confidence: "ai_estimate",
        }),
      ])
    )

    render(<PendingAiReviewPanel canWrite={true} />)

    const names = screen.getAllByText(/risk$/i).map((el) => el.textContent)
    expect(names).toEqual([
      "No citation risk",
      "Estimate risk",
      "Verified risk",
    ])
  })

  it("shows dismissed risks only after 'Show dismissed' is clicked (lazy query)", async () => {
    mockUseGetAllRisksQuery.mockImplementation(
      routeByReviewStatus(
        [makePendingRisk()],
        [makePendingRisk({ id: "risk-dismissed", name: "Dismissed risk" })]
      )
    )

    render(<PendingAiReviewPanel canWrite={true} />)
    expect(screen.queryByText("Dismissed risk")).not.toBeInTheDocument()
    // Proves the query itself was actually skipped, not just that the UI
    // hasn't rendered already-fetched data yet -- the mock's own
    // skip-awareness (routeByReviewStatus above) means this would fail if
    // `{ skip: !showDismissed }` were removed from the component.
    expect(mockUseGetAllRisksQuery).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: "DISMISSED" }),
      expect.objectContaining({ skip: true })
    )

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.pendingReview.showDismissed",
      })
    )

    expect(mockUseGetAllRisksQuery).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: "DISMISSED" }),
      expect.objectContaining({ skip: false })
    )
    expect(screen.getByText("Dismissed risk")).toBeInTheDocument()
  })
})
