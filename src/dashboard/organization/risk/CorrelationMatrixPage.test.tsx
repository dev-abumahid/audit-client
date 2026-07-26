import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CorrelationMatrixPage from "./CorrelationMatrixPage"

// SiteFilter independently calls useGetAllSitesQuery for its dropdown --
// stubbed out so this test file stays scoped to the page's own data wiring,
// same pattern RiskGraphPage.test.tsx / RiskRegisterPage.test.tsx use.
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: () => null,
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

// Role hook mocked per-test via this mutable holder, same convention as
// IntelligencePage.test.tsx / RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

const mockUseGetCorrelationMatrixDataQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()
const mockCreateRiskLink = vi.fn()
const mockDeleteRiskLink = vi.fn()
const mockRunRootCauseBucketing = vi.fn()
const mockCreateActionFromBucket = vi.fn()
// Mutable so a test can flip the real loading state the component reads off
// the mutation hook (not local component state) -- see the "shows a loading
// state" test below.
let mockIsRunningBucketing = false

vi.mock("@/redux/apis/organization/riskLink.api", () => ({
  useGetCorrelationMatrixDataQuery: (...args: unknown[]) =>
    mockUseGetCorrelationMatrixDataQuery(...args),
  useCreateRiskLinkMutation: () => [
    mockCreateRiskLink,
    { isLoading: false },
  ],
  useDeleteRiskLinkMutation: () => [mockDeleteRiskLink, { isLoading: false }],
  useRunRootCauseBucketingMutation: () => [
    mockRunRootCauseBucketing,
    { isLoading: mockIsRunningBucketing },
  ],
  useCreateActionFromBucketMutation: () => [mockCreateActionFromBucket, {}],
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

function makeRisk(overrides = {}) {
  return {
    id: "risk-uuid-1",
    org_account_id: "org-1",
    ref: "CYB-001",
    name: "Cyberattaque ransomware",
    description: "Risque de blocage des systèmes",
    category: "cyber",
    inherent_score: 22,
    residual_score: 14,
    pagerank_score: 88,
    financial_impact_min: 500000,
    financial_impact_max: 2500000,
    probability: 75,
    velocity: "fast",
    trend: "up",
    status: "open",
    ai_generated: true,
    is_edited: false,
    site_id: "site1",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    line_of_defense: "FIRST",
    ...overrides,
  }
}

function makeLink(overrides = {}) {
  return {
    id: "link-1",
    org_account_id: "org-1",
    source_ref: "OPS-002",
    target_ref: "CYB-001",
    link_type: "CAUSES",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeAction(overrides = {}) {
  return {
    id: "action-1",
    orgAccountId: "org-1",
    inspectionId: "insp-1",
    actionTitle: "Weak access control",
    actionDisc: "No MFA in place",
    priority: "High",
    dueDate: "2026-07-01T00:00:00.000Z",
    status: "TO_DO",
    messages: [],
    assignBy: [],
    attachments: [],
    line_of_defense: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeAiRiskBucket(overrides = {}) {
  return {
    bucketName: "Supplier concentration",
    rootCause: "Single-source dependency",
    rootCauseCategory: "process",
    category: "operational",
    riskRefs: ["OPS-002", "CYB-001"],
    pageRankScore: 88,
    aggregatedImpactMin: 100000,
    aggregatedImpactMax: 500000,
    groupedAction: {
      description: "Diversify suppliers",
      normReference: "ISO 28000",
      owner: "Supply Chain Manager",
      priority: "short_term",
      estimatedRiskReduction: 40,
      estimatedCost: "medium",
      timeline: "6 months",
    },
    dominoRisk: null,
    ...overrides,
  }
}

// Runs the AI analysis (resolving to a single risk bucket) and expands it,
// landing on the expanded AIRiskBucketCard where the "Send to Finding"
// button lives -- shared setup for every send-to-finding test below.
async function renderWithExpandedAiBucket(
  bucket = makeAiRiskBucket()
) {
  mockRunRootCauseBucketing.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        success: true,
        message: "ok",
        data: {
          methodology: "PageRank clustering",
          riskBuckets: [bucket],
          findingBuckets: [],
        },
      }),
  })

  render(<CorrelationMatrixPage />)

  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.correlationMatrix.viewAiBuckets",
    })
  )
  await userEvent.click(
    screen.getByRole("button", {
      name: "organization.correlationMatrix.aiRunAnalysis",
    })
  )
  await waitFor(() =>
    expect(screen.getByText(bucket.bucketName)).toBeInTheDocument()
  )
  await userEvent.click(screen.getByText(bucket.bucketName))
}

function setMatrixData({
  risks = [makeRisk()],
  riskLinks = [] as ReturnType<typeof makeLink>[],
  actions = [] as ReturnType<typeof makeAction>[],
} = {}) {
  mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
    data: { success: true, message: "ok", data: { risks, riskLinks, actions } },
    isLoading: false,
    isFetching: false,
  })
}

describe("CorrelationMatrixPage", () => {
  beforeEach(() => {
    mockUseGetCorrelationMatrixDataQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockCreateRiskLink.mockReset()
    mockDeleteRiskLink.mockReset()
    mockRunRootCauseBucketing.mockReset()
    mockCreateActionFromBucket.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockRole = "ADMIN"
    mockIsRunningBucketing = false
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site1", name: "Siège Paris" }] },
    })
    setMatrixData()
  })

  it("shows a loading state while the correlation matrix data is loading", () => {
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    })

    render(<CorrelationMatrixPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders the page header and real risk data from the live query", async () => {
    setMatrixData({
      risks: [makeRisk({ ref: "CYB-001", name: "Cyberattaque ransomware" })],
    })

    render(<CorrelationMatrixPage />)

    expect(
      screen.getByText("organization.correlationMatrix.title")
    ).toBeInTheDocument()

    // Confirms the query's real risk data actually reaches the DOM, not
    // just that the static page chrome renders regardless of what the
    // query returns -- open the link form (its risk picker options are
    // built directly from the query result) and check the real ref/name.
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )
    // Appears once in each of the source/target <select>s (only one risk
    // exists in this fixture, and neither select has filtered it out yet).
    expect(
      screen.getAllByText("CYB-001 — Cyberattaque ransomware").length
    ).toBeGreaterThan(0)
  })

  it("places risks in the matrix grid using real ref-keyed RiskLink rows", () => {
    setMatrixData({
      risks: [
        makeRisk({ id: "r1", ref: "CYB-001" }),
        makeRisk({ id: "r2", ref: "OPS-002", name: "Supply chain risk" }),
      ],
      riskLinks: [makeLink({ source_ref: "OPS-002", target_ref: "CYB-001" })],
    })

    render(<CorrelationMatrixPage />)

    // OPS-002 CAUSES CYB-001, so both risks land in a populated grid cell
    // (CYB-001 has 1 root cause, OPS-002 has 1 consequence) -- clicking any
    // populated cell reveals its risk in the detail panel by its real ref.
    const populatedCells = screen.getAllByRole("button", {
      name: /1.*organization\.correlationMatrix\.riskWord/,
    })
    fireEvent.click(populatedCells[0])
    expect(screen.getByText(/^(CYB-001|OPS-002)$/)).toBeInTheDocument()
  })

  it("shows the Add Link control and existing links for ADMIN", () => {
    mockRole = "ADMIN"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />)

    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/OPS-002/)).toBeInTheDocument()
  })

  it("hides the Add Link control and delete buttons for a non-privileged role", () => {
    mockRole = "VIEWER"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />)

    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    ).not.toBeInTheDocument()
  })

  it("shows the Add Link control for LEAD_AUDITOR", () => {
    mockRole = "LEAD_AUDITOR"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />)

    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    ).toBeInTheDocument()
  })

  it("hides the Add Link control for LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />)

    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    ).not.toBeInTheDocument()
  })

  it("rejects a self-referencing link client-side without calling the mutation", async () => {
    setMatrixData({
      risks: [makeRisk({ id: "r1", ref: "CYB-001" })],
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.correlationMatrix.linkFormSourceLabel"),
      "CYB-001"
    )

    // The target select filters out whatever's currently selected as
    // source, so there's no <option value="CYB-001"> left to pick -- this
    // itself proves the client-side exclusion works (round-1 review gap).
    const targetSelect = screen.getByLabelText(
      "organization.correlationMatrix.linkFormTargetLabel"
    ) as HTMLSelectElement
    expect(
      Array.from(targetSelect.options).some((o) => o.value === "CYB-001")
    ).toBe(false)

    expect(mockCreateRiskLink).not.toHaveBeenCalled()
  })

  it("submits the create-link form and calls the mutation", async () => {
    mockCreateRiskLink.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeLink() }),
    })
    setMatrixData({
      risks: [
        makeRisk({ id: "r1", ref: "CYB-001" }),
        makeRisk({ id: "r2", ref: "OPS-002", name: "Supply chain risk" }),
      ],
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )

    await userEvent.selectOptions(
      screen.getByLabelText("organization.correlationMatrix.linkFormSourceLabel"),
      "CYB-001"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.correlationMatrix.linkFormTargetLabel"),
      "OPS-002"
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.linkFormSubmit",
      })
    )

    await waitFor(() =>
      expect(mockCreateRiskLink).toHaveBeenCalledWith({
        source_ref: "CYB-001",
        target_ref: "OPS-002",
        link_type: "CAUSES",
      })
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows a toast with the real error message when link creation fails", async () => {
    mockCreateRiskLink.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "This risk link already exists" } }),
    })
    setMatrixData({
      risks: [
        makeRisk({ id: "r1", ref: "CYB-001" }),
        makeRisk({ id: "r2", ref: "OPS-002", name: "Supply chain risk" }),
      ],
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.correlationMatrix.linkFormSourceLabel"),
      "CYB-001"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.correlationMatrix.linkFormTargetLabel"),
      "OPS-002"
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.linkFormSubmit",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("This risk link already exists")
    )
  })

  it("deletes a link when the delete button is clicked", async () => {
    mockDeleteRiskLink.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeLink() }),
    })
    setMatrixData({ riskLinks: [makeLink({ id: "link-42" })] })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    )

    await waitFor(() => expect(mockDeleteRiskLink).toHaveBeenCalledWith("link-42"))
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows a toast with the real error message when link deletion fails", async () => {
    mockDeleteRiskLink.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Risk link not found" } }),
    })
    setMatrixData({ riskLinks: [makeLink({ id: "link-42" })] })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Risk link not found")
    )
  })

  it("shows a loading state on the AI analysis button while the mutation is in flight", async () => {
    // useRunRootCauseBucketingMutation's mock return value is static
    // ({isLoading: false} always) elsewhere in this file, so this test
    // needs its own mutable backing value -- the component reads
    // `isLoading` off the mutation hook itself (CorrelationMatrixPage.tsx
    // line 166), not local component state, so the mock has to actually
    // flip for a real transition to be observable. Same rerender-after-
    // mutating-the-mock technique as IntelligencePage.test.tsx's post-
    // success transition test.
    let resolveMutation: (value: unknown) => void = () => {}
    mockRunRootCauseBucketing.mockImplementation(() => {
      mockIsRunningBucketing = true
      return {
        unwrap: () =>
          new Promise((resolve) => {
            resolveMutation = resolve
          }),
      }
    })

    const { rerender } = render(<CorrelationMatrixPage />)
    const rerenderPage = () => rerender(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewAiBuckets",
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.aiRunAnalysis",
      })
    )
    rerenderPage()

    expect(mockIsRunningBucketing).toBe(true)
    const loadingButton = screen.getByRole("button", {
      name: "organization.correlationMatrix.aiAnalyzing",
    })
    expect(loadingButton).toBeDisabled()

    mockIsRunningBucketing = false
    resolveMutation({
      success: true,
      message: "ok",
      data: { methodology: "x", riskBuckets: [], findingBuckets: [] },
    })
    await waitFor(() => rerenderPage())
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "organization.correlationMatrix.aiRunAnalysis",
        })
      ).not.toBeDisabled()
    )
  })

  it("triggers the AI root-cause bucketing mutation and renders real buckets", async () => {
    mockRunRootCauseBucketing.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: {
            methodology: "PageRank clustering",
            riskBuckets: [
              {
                bucketName: "Supplier concentration",
                rootCause: "Single-source dependency",
                rootCauseCategory: "process",
                category: "operational",
                riskRefs: ["OPS-002"],
                pageRankScore: 88,
                aggregatedImpactMin: 100000,
                aggregatedImpactMax: 500000,
                groupedAction: {
                  description: "Diversify suppliers",
                  normReference: "ISO 28000",
                  owner: "Supply Chain Manager",
                  priority: "short_term",
                  estimatedRiskReduction: 40,
                  estimatedCost: "medium",
                  timeline: "6 months",
                },
                dominoRisk: null,
              },
            ],
            findingBuckets: [],
          },
        }),
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewAiBuckets",
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.aiRunAnalysis",
      })
    )

    await waitFor(() => expect(mockRunRootCauseBucketing).toHaveBeenCalled())
    expect(screen.getByText("Supplier concentration")).toBeInTheDocument()
  })

  it("shows a toast when the AI bucketing mutation fails", async () => {
    mockRunRootCauseBucketing.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "AI service error: 502" } }),
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewAiBuckets",
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.aiRunAnalysis",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("AI service error: 502")
    )
  })

  it("shows the Send to Finding button for ADMIN and calls the mutation with the bucket's groupedAction + riskRefs", async () => {
    mockRole = "ADMIN"
    mockCreateActionFromBucket.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeAction() }),
    })
    const bucket = makeAiRiskBucket()
    await renderWithExpandedAiBucket(bucket)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    )

    await waitFor(() =>
      expect(mockCreateActionFromBucket).toHaveBeenCalledWith({
        ...bucket.groupedAction,
        riskRefs: bucket.riskRefs,
      })
    )
  })

  it("shows the Send to Finding button for LEAD_AUDITOR", async () => {
    mockRole = "LEAD_AUDITOR"
    await renderWithExpandedAiBucket()

    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    ).toBeInTheDocument()
  })

  it("hides the Send to Finding button for LIGHT_USER", async () => {
    mockRole = "LIGHT_USER"
    await renderWithExpandedAiBucket()

    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    ).not.toBeInTheDocument()
  })

  it("hides the Send to Finding button for VIEWER", async () => {
    mockRole = "VIEWER"
    await renderWithExpandedAiBucket()

    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    ).not.toBeInTheDocument()
  })

  it("shows a success toast and disables the button after sending a bucket to Finding", async () => {
    mockCreateActionFromBucket.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeAction() }),
    })
    await renderWithExpandedAiBucket()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    )

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    // Post-success state: the button disables and relabels to reflect
    // "already sent" for this bucket (local-state flag, see the component's
    // sentBucketNames comment -- no persisted id exists on an ephemeral AI
    // bucket to track this against server-side).
    const sentButton = await screen.findByRole("button", {
      name: "organization.correlationMatrix.sendToFindingSent",
    })
    expect(sentButton).toBeDisabled()
  })

  it("shows a toast with the real backend error message when sending to Finding fails", async () => {
    mockCreateActionFromBucket.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Risk ref(s) not found in this organization: OPS-999" },
        }),
    })
    await renderWithExpandedAiBucket()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Risk ref(s) not found in this organization: OPS-999"
      )
    )
    // Failure doesn't mark the bucket as sent -- the button stays actionable.
    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    ).not.toBeDisabled()
  })

  it("sending one bucket to Finding does not mark a different bucket as sent (round-1 review gap)", async () => {
    const bucketA = makeAiRiskBucket({ bucketName: "Supplier concentration" })
    const bucketB = makeAiRiskBucket({
      bucketName: "Access control gaps",
      rootCause: "Weak MFA enforcement",
      groupedAction: {
        ...makeAiRiskBucket().groupedAction,
        description: "Enforce MFA org-wide",
      },
    })
    mockCreateActionFromBucket.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeAction() }),
    })
    mockRunRootCauseBucketing.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: {
            methodology: "PageRank clustering",
            riskBuckets: [bucketA, bucketB],
            findingBuckets: [],
          },
        }),
    })

    render(<CorrelationMatrixPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewAiBuckets",
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.aiRunAnalysis",
      })
    )
    await waitFor(() =>
      expect(screen.getByText(bucketA.bucketName)).toBeInTheDocument()
    )

    // Expand bucket A, send it, confirm it's now marked sent.
    await userEvent.click(screen.getByText(bucketA.bucketName))
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    )
    await screen.findByRole("button", {
      name: "organization.correlationMatrix.sendToFindingSent",
    })
    // Collapse A (only one bucket's detail is expanded at a time).
    await userEvent.click(screen.getByText(bucketA.bucketName))

    // Expand bucket B -- it must show as still actionable, not "sent",
    // proving the sent-state is genuinely isolated per bucket rather than
    // a single shared flag that any successful send flips for every bucket.
    await userEvent.click(screen.getByText(bucketB.bucketName))
    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    ).not.toBeDisabled()
    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.sendToFindingSent",
      })
    ).not.toBeInTheDocument()
  })

  it("groups findings from real Action rows in the findings view", () => {
    setMatrixData({
      actions: [
        makeAction({ id: "a1", priority: "High" }),
        makeAction({ id: "a2", priority: "High", actionTitle: "Unencrypted data" }),
      ],
    })

    render(<CorrelationMatrixPage />)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )

    expect(
      screen.getByText("organization.correlationMatrix.findingPriorityBucketName")
    ).toBeInTheDocument()
  })
})
