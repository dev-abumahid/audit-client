import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CorrelationMatrixPage from "./CorrelationMatrixPage"

// SiteFilter independently calls useGetAllSitesQuery for its dropdown --
// stubbed out so this test file stays scoped to the page's own data wiring,
// same pattern RiskGraphPage.test.tsx / RiskRegisterPage.test.tsx use. A
// minimal button (rather than the real `null`-only stub) exposes just enough
// of its onChange contract to drive the selectedCell-reset-on-filter-change
// test (aexa-frontend#257) without pulling in the real dropdown/query.
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: ({ onChange }: { onChange: (siteId: string | null) => void }) => (
    <button onClick={() => onChange("site1")}>mock-site-filter-change</button>
  ),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce aexa-frontend#257 (a raw literal "{{rootCause}}"/"{{consequence}}"
// placeholder left in the *interpolated* string when the value passed in is
// undefined) since the raw-key fallback never contains those placeholders to
// begin with. Overriding just the one real key under test, with the same
// "leave the placeholder in when the interpolation value is undefined"
// behavior i18next itself has with no missingInterpolationHandler configured
// (src/i18n/i18n.ts), lets the test tell an out-of-range selectedCell (bug)
// apart from a null one (clean empty state) -- every other key still falls
// back to itself unchanged, so no existing assertion elsewhere in this file
// is affected. Same technique as IntelligencePage.test.tsx.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        if (key === "organization.correlationMatrix.cellRisksHeading") {
          const rootCause = opts?.rootCause
          const consequence = opts?.consequence
          return `${opts?.count} risk(s) — ${
            rootCause === undefined ? "{{rootCause}}" : String(rootCause)
          } / ${
            consequence === undefined ? "{{consequence}}" : String(consequence)
          }`
        }
        return key
      },
    }),
  }
})

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

  // Regression (issue #357/#358): "group by category" rendered the raw
  // risk.category string ("cyber") instead of a resolved label, and the
  // page maintained its own stale local 4-entry RISK_CATEGORIES map instead
  // of importing the shared 20-entry one from riskConfig.ts -- a risk in a
  // category outside that local 4 (e.g. "supply_chain") fell through to the
  // raw string too. i18n isn't loaded in this test file, so t() falls back
  // to the raw key -- asserting the resolved organization.riskCategories.*
  // key text (not the raw category value) proves the lookup now goes
  // through the shared map.
  it("resolves the selected cell's group-by-category label instead of the raw category string", async () => {
    setMatrixData({
      risks: [makeRisk({ id: "r1", ref: "CYB-001", category: "cyber" })],
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: /1.*organization\.correlationMatrix\.riskWord/,
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.groupByType",
      })
    )

    expect(
      screen.getByText(/organization\.riskCategories\.catCyber/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/^cyber \(1\)$/)).not.toBeInTheDocument()
  })

  it("resolves a category outside the old local 4-entry map (e.g. supply_chain), proving it now uses the shared riskConfig map", async () => {
    setMatrixData({
      risks: [
        makeRisk({ id: "r1", ref: "SUP-001", category: "supply_chain" }),
      ],
    })

    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", {
        name: /1.*organization\.correlationMatrix\.riskWord/,
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.groupByType",
      })
    )

    expect(
      screen.getByText(/organization\.riskCategories\.catSupplyChain/)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/^supply_chain \(1\)$/)
    ).not.toBeInTheDocument()
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

  // Regression (audit round 3): the existing-links list rendered the raw
  // `link.link_type` value ("CAUSES"/"AMPLIFIES"/"CORRELATES") instead of
  // going through t() with the linkTypeCauses/linkTypeAmplifies/
  // linkTypeCorrelates keys the "+ Link" form's <select> already used a few
  // lines above it. i18n isn't loaded in this test file, so t() falls back
  // to the raw key -- asserting the translated key text (not the raw enum
  // value) proves the list now uses the same mapping as the form.
  it("renders the existing link's type through the same i18n keys as the Add Link form's type select, not the raw enum value", () => {
    mockRole = "ADMIN"
    setMatrixData({ riskLinks: [makeLink({ link_type: "AMPLIFIES" })] })

    render(<CorrelationMatrixPage />)

    expect(
      screen.getByText("organization.correlationMatrix.linkTypeAmplifies")
    ).toBeInTheDocument()
    expect(screen.queryByText("AMPLIFIES")).not.toBeInTheDocument()
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

  // aexa-frontend#194: bucketName is AI-generated free text with no
  // uniqueness guarantee -- nothing stops a single response from returning
  // two distinct buckets that happen to share the exact same name. State
  // keyed by bucketName would conflate them; this proves the fix (keying by
  // array index instead) actually isolates them even when the name collides,
  // not just when it happens to differ (the test above).
  it("sending one bucket to Finding does not mark a same-named bucket as sent", async () => {
    const bucketA = makeAiRiskBucket({ bucketName: "Cyber risk cluster" })
    const bucketB = makeAiRiskBucket({
      bucketName: "Cyber risk cluster",
      rootCause: "A completely different root cause",
      groupedAction: {
        ...makeAiRiskBucket().groupedAction,
        description: "A completely different action",
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
    const headers = await waitFor(() => {
      const found = screen.getAllByText("Cyber risk cluster")
      expect(found).toHaveLength(2)
      return found
    })
    const cardA = headers[0].closest(".rounded-lg") as HTMLElement
    const cardB = headers[1].closest(".rounded-lg") as HTMLElement

    // Expand and send bucket A only.
    await userEvent.click(headers[0])
    await userEvent.click(
      within(cardA).getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    )
    await within(cardA).findByRole("button", {
      name: "organization.correlationMatrix.sendToFindingSent",
    })

    // Bucket B, despite sharing bucketA's exact name, must still be
    // actionable -- proving the sent-state is isolated by index, not
    // conflated by the two buckets' identical name.
    await userEvent.click(headers[1])
    expect(
      within(cardB).getByRole("button", {
        name: "organization.correlationMatrix.sendToFinding",
      })
    ).not.toBeDisabled()
    expect(
      within(cardB).queryByRole("button", {
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

  // Regression (audit round 4 / #347): each finding's priority badge inside
  // an expanded finding bucket rendered f.priority raw/untranslated, with
  // color logic only special-casing "High" (everything else, including
  // "Low", rendered the same orange as "Medium"). Now routed through the
  // same organization.findings.priorityLow/Medium/High keys used by
  // AllFindingsPage.tsx/FindingDetails.tsx/InspectionActions.tsx for the
  // identical field, with all three levels visually distinct.
  it("shows each finding's priority via the shared organization.findings.priority i18n keys, distinguishing High from Low", async () => {
    setMatrixData({
      actions: [
        makeAction({ id: "a1", priority: "High", actionTitle: "Weak MFA" }),
        makeAction({
          id: "a2",
          priority: "High",
          actionTitle: "Unencrypted data",
        }),
      ],
    })

    render(<CorrelationMatrixPage />)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )
    fireEvent.click(
      screen.getByText(
        "organization.correlationMatrix.findingPriorityBucketName"
      )
    )

    const badges = await screen.findAllByText(
      "organization.findings.priorityHigh"
    )
    expect(badges).toHaveLength(2)
    expect(
      screen.queryAllByText((_, el) => el?.textContent === "High")
    ).toHaveLength(0)
    for (const badge of badges) {
      expect(badge).toHaveClass("bg-red-100")
    }
  })

  it("gives a Low-priority finding badge a different color than High (not the same orange for both)", async () => {
    setMatrixData({
      actions: [
        makeAction({ id: "a1", priority: "Low", actionTitle: "Minor gap" }),
        makeAction({
          id: "a2",
          priority: "Low",
          actionTitle: "Cosmetic issue",
        }),
      ],
    })

    render(<CorrelationMatrixPage />)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )
    fireEvent.click(
      screen.getByText(
        "organization.correlationMatrix.findingPriorityBucketName"
      )
    )

    const badges = await screen.findAllByText(
      "organization.findings.priorityLow"
    )
    expect(badges).toHaveLength(2)
    for (const badge of badges) {
      expect(badge).toHaveClass("bg-green-100")
      expect(badge).not.toHaveClass("bg-orange-100")
    }
  })

  // aexa-frontend#257: riskGrid's keys are in mapToAxis(matrixSize)-space,
  // which is a different coordinate space per matrixSize/site filter, so a
  // selectedCell picked under one of those can point at a row/col that's out
  // of range (or just means something different) after either changes.
  // Builds a risk with 4 root causes and 4 consequences so it lands in the
  // (row 4, col 4) corner cell of the default 5x5 matrix -- the one that
  // becomes out of range the moment the matrix drops to 3x3 (whose rows/cols
  // only go up to index 2).
  function setCornerCellMatrixData() {
    const target = makeRisk({ id: "tgt", ref: "TGT-001" })
    const sources = [1, 2, 3, 4].map((n) =>
      makeRisk({ id: `src${n}`, ref: `OPS-SRC-${n}` })
    )
    const dests = [1, 2, 3, 4].map((n) =>
      makeRisk({ id: `dst${n}`, ref: `OPS-DST-${n}` })
    )
    setMatrixData({
      risks: [target, ...sources, ...dests],
      riskLinks: [
        ...sources.map((s) => makeLink({ source_ref: s.ref, target_ref: target.ref })),
        ...dests.map((d) => makeLink({ source_ref: target.ref, target_ref: d.ref })),
      ],
    })
  }

  it("resets selectedCell when matrixSize changes, instead of showing a raw {{...}} placeholder for an out-of-range cell", async () => {
    setCornerCellMatrixData()
    render(<CorrelationMatrixPage />)

    // The (row 4, col 4) corner cell holds exactly TGT-001 (4 root causes,
    // 4 consequences) -- select it.
    await userEvent.click(
      screen.getByRole("button", { name: /1.*organization\.correlationMatrix\.riskWord/ })
    )
    expect(screen.getByText(/1 risk\(s\) —/)).toBeInTheDocument()

    // Drop to a 3x3 matrix -- row/col index 4 no longer exists in that
    // axis's label array.
    await userEvent.click(screen.getByRole("button", { name: "3×3" }))

    // Pre-fix, selectedCell survives the resize unreset and the heading
    // renders with `axisLabels.rootCause[4]`/`.consequence[4]` both
    // `undefined`, which the (unconfigured) i18n interpolation leaves as a
    // raw literal placeholder. Post-fix, selectedCell is cleared back to the
    // clean "select a cell" empty state instead.
    expect(screen.queryByText(/\{\{rootCause\}\}/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\{\{consequence\}\}/)).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.correlationMatrix.selectCellHeading")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.correlationMatrix.clickCellHint")
    ).toBeInTheDocument()
  })

  it("resets selectedCell when the site filter changes, instead of showing a raw {{...}} placeholder for a stale cell", async () => {
    setCornerCellMatrixData()
    render(<CorrelationMatrixPage />)

    await userEvent.click(
      screen.getByRole("button", { name: /1.*organization\.correlationMatrix\.riskWord/ })
    )
    expect(screen.getByText(/1 risk\(s\) —/)).toBeInTheDocument()

    // Mocked SiteFilter's onChange -- see the module mock above.
    await userEvent.click(
      screen.getByRole("button", { name: "mock-site-filter-change" })
    )

    expect(screen.queryByText(/\{\{rootCause\}\}/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\{\{consequence\}\}/)).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.correlationMatrix.selectCellHeading")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.correlationMatrix.clickCellHint")
    ).toBeInTheDocument()
  })
})
