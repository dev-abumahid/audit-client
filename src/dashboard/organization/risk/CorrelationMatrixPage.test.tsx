import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import CorrelationMatrixPage from "./CorrelationMatrixPage"

// aexa-frontend#549: RiskDetailCard/BucketList risk rows now render real
// <Link>s, so every render() needs a Router context. RTL's `wrapper` option
// applies to `rerender()` too (see the `rerenderPage` usage below), so this
// is a drop-in addition rather than needing a renderPage() helper everywhere.
const withRouter = { wrapper: MemoryRouter }

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
        // aexa-frontend#376 -- same real-interpolation override, added so
        // the bucketMeta impact-in-M€ regression test below can assert on
        // the actual computed number rather than the raw un-interpolated
        // key every other key in this file falls back to.
        if (key === "organization.correlationMatrix.bucketMeta") {
          return `${opts?.count} risks • ${opts?.impact}M€`
        }
        // aexa-frontend#394 -- real-interpolation override so the finding
        // bucket name regression test below can assert on the actual
        // (translated) priority text rather than the raw un-interpolated
        // key every other key in this file falls back to.
        if (
          key === "organization.correlationMatrix.findingPriorityBucketName"
        ) {
          return `${opts?.priority} priority`
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
// Same convention -- lets the double-submission-guard test below flip this
// to true without a static mock.
let mockIsDeletingLink = false

vi.mock("@/redux/apis/organization/riskLink.api", () => ({
  useGetCorrelationMatrixDataQuery: (...args: unknown[]) =>
    mockUseGetCorrelationMatrixDataQuery(...args),
  useCreateRiskLinkMutation: () => [mockCreateRiskLink, { isLoading: false }],
  useDeleteRiskLinkMutation: () => [
    mockDeleteRiskLink,
    { isLoading: mockIsDeletingLink },
  ],
  useRunRootCauseBucketingMutation: () => [
    mockRunRootCauseBucketing,
    { isLoading: mockIsRunningBucketing },
  ],
  useCreateActionFromBucketMutation: () => [mockCreateActionFromBucket, {}],
}))

// quality-bar-loop-derived fix: this page previously deleted a risk link
// immediately on click with no confirmation step -- now routes through the
// same shared DeleteAlertModal every other delete action in this codebase
// uses. Mocked the same way as RiskRegisterPage.test.tsx/InspectionTable.test.tsx.
vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({
    open,
    onConfirm,
    loading,
    setOpen,
  }: {
    open: boolean
    onConfirm: () => void
    loading?: boolean
    setOpen?: (value: boolean) => void
  }) =>
    open ? (
      <>
        <button onClick={onConfirm} disabled={loading}>
          Confirm delete
        </button>
        <button onClick={() => setOpen?.(false)}>Cancel delete</button>
      </>
    ) : null,
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
async function renderWithExpandedAiBucket(bucket = makeAiRiskBucket()) {
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

  render(<CorrelationMatrixPage />, withRouter)

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
    mockIsDeletingLink = false
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

    render(<CorrelationMatrixPage />, withRouter)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  // quality-bar-loop round 4 (resilience, the round-1 finding carried
  // forward): isError was never checked on either query -- a genuine
  // fetch failure fell through to risks: []/riskLinks: [] and rendered a
  // fully-formed, normal-looking empty matrix, byte-for-byte
  // indistinguishable from "this org genuinely has zero risks." Mirrors
  // RiskMatrixPage's own round-3 fix.
  it("shows a distinct error state, not an empty matrix, when the correlation matrix query fails", () => {
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
    })
    render(<CorrelationMatrixPage />, withRouter)

    expect(
      screen.getByText("organization.correlationMatrix.loadError")
    ).toBeInTheDocument()
    // The matrix (and every control that's meaningless without data)
    // must not render at all in the error state.
    expect(
      screen.queryByRole("button", { name: "5×5" })
    ).not.toBeInTheDocument()
  })

  it("shows a site-load-error indicator, not a silent missing site name, when the sites query fails", () => {
    setMatrixData({ risks: [makeRisk()] })
    mockUseGetAllSitesQuery.mockReturnValue({ data: undefined, isError: true })
    render(<CorrelationMatrixPage />, withRouter)

    expect(
      screen.getByText("organization.correlationMatrix.siteLoadError")
    ).toBeInTheDocument()
    // The matrix itself still renders -- a sites-fetch failure only
    // affects site-name lookups, not the whole page.
    expect(screen.getByRole("button", { name: "5×5" })).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the matrix-size,
  // group-mode, and view-mode toggle buttons were 28px tall, under the
  // 44px minimum touch-target guideline -- same fix RiskMatrixPage
  // round 7 already shipped for its own identical toggle groups.
  it("gives the matrix-size, group-mode, and view-mode toggle buttons a 44px touch target", () => {
    render(<CorrelationMatrixPage />, withRouter)

    expect(screen.getByRole("button", { name: "5×5" }).className).toContain(
      "h-11"
    )
    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.groupAll",
      }).className
    ).toContain("h-11")
    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewRisks",
      }).className
    ).toContain("h-11")
  })

  // quality-bar-loop round 2 (mobile, the axis's most severe round-1
  // finding): the root-cause row-label column used to scroll away
  // together with the grid cells inside the same horizontal-scroll
  // wrapper, so a phone user couldn't see a cell's row label and a
  // rightmost-column cell at the same time.
  it("pins the root-cause row-label column so it doesn't scroll away with the grid", () => {
    setMatrixData({ risks: [makeRisk()] })
    render(<CorrelationMatrixPage />, withRouter)

    const rowLabel = screen.getByText(
      "organization.correlationMatrix.axisCauseNone"
    )
    expect(rowLabel.className).toContain("sticky")
    expect(rowLabel.className).toContain("left-0")
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the legend used
  // to sit inside the grid's horizontally-scrolling, forced-min-width
  // wrapper, so two full swatches rendered entirely outside the visible
  // viewport at 375px with no scroll affordance.
  it("renders the legend outside the matrix's horizontal-scroll wrapper", () => {
    render(<CorrelationMatrixPage />, withRouter)

    const legendLabel = screen.getByText("riskLevel.critical")
    const scrollWrapper = document.querySelector(".overflow-auto")
    expect(scrollWrapper).not.toBeNull()
    expect(scrollWrapper?.contains(legendLabel)).toBe(false)
  })

  // quality-bar-loop round 3 (visual polish, round-1 finding): the legend
  // used to say "Systemic node/High interconnection/Moderate/Isolated" --
  // a one-off vocabulary invented just for this page -- while this same
  // page's own RiskDetailCard shows a RiskBadge reading
  // "Critical/High/Medium/Low", the canonical shared severity vocabulary
  // used everywhere else in the app. Same 4-bucket concept, two
  // vocabularies on one screen. Mirrors RiskMatrixPage's own round 9 fix.
  it("uses the same severity vocabulary in the legend as RiskBadge uses on the detail card", () => {
    render(<CorrelationMatrixPage />, withRouter)

    const legend = document.querySelector(
      ".mt-6.flex.flex-wrap.gap-4"
    ) as HTMLElement
    expect(legend).not.toBeNull()
    expect(within(legend).getByText("riskLevel.critical")).toBeInTheDocument()
    expect(within(legend).getByText("riskLevel.high")).toBeInTheDocument()
    expect(within(legend).getByText("riskLevel.medium")).toBeInTheDocument()
    expect(within(legend).getByText("riskLevel.low")).toBeInTheDocument()
    // The old page-local vocabulary must be gone from the legend.
    expect(
      within(legend).queryByText(
        "organization.correlationMatrix.legendSystemic"
      )
    ).not.toBeInTheDocument()
    expect(
      within(legend).queryByText(
        "organization.correlationMatrix.legendHighInterconnection"
      )
    ).not.toBeInTheDocument()
    expect(
      within(legend).queryByText(
        "organization.correlationMatrix.legendModerate"
      )
    ).not.toBeInTheDocument()
    expect(
      within(legend).queryByText(
        "organization.correlationMatrix.legendIsolated"
      )
    ).not.toBeInTheDocument()
  })

  it("renders the page header and real risk data from the live query", async () => {
    setMatrixData({
      risks: [makeRisk({ ref: "CYB-001", name: "Cyberattaque ransomware" })],
    })

    render(<CorrelationMatrixPage />, withRouter)

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

    render(<CorrelationMatrixPage />, withRouter)

    // OPS-002 CAUSES CYB-001, so both risks land in a populated grid cell
    // (CYB-001 has 1 root cause, OPS-002 has 1 consequence) -- clicking any
    // populated cell reveals its risk in the detail panel by its real ref.
    const populatedCells = screen.getAllByRole("button", {
      name: /^1 risk\(s\)/,
    })
    fireEvent.click(populatedCells[0])
    // aexa-frontend#569 added a second place ("Existing Links") that also
    // renders these exact refs, now as <Link>s -- match specifically on the
    // detail card's own <p> ref element rather than any element with this
    // text.
    const refMatches = screen.getAllByText(/^(CYB-001|OPS-002)$/)
    expect(
      refMatches.some((el) => el.tagName.toLowerCase() === "p")
    ).toBe(true)
  })

  // aexa-frontend#549: RiskDetailCard's risk name and site name were plain
  // text even though risk.id/site_id were already on the card's data --
  // same gap #548 fixed on the functionally-identical card in
  // RiskMatrixPage.tsx.
  it("links the selected risk's name and site in the detail card", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site1", name: "Casablanca HQ" }] },
      isLoading: false,
    })
    setMatrixData({
      risks: [
        makeRisk({
          id: "risk-uuid-1",
          ref: "CYB-001",
          name: "Cyberattaque ransomware",
          site_id: "site1",
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    const populatedCells = screen.getAllByRole("button", {
      name: /^1 risk\(s\)/,
    })
    fireEvent.click(populatedCells[0])

    const riskLink = screen.getByRole("link", {
      name: "Cyberattaque ransomware",
    })
    expect(riskLink).toHaveAttribute(
      "href",
      "/organization/risks/risk-uuid-1"
    )

    const siteLink = screen.getByRole("link", { name: /Casablanca HQ/ })
    expect(siteLink).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site1&search=Casablanca%20HQ"
    )
  })

  // getRiskSeverityLevel silently maps a missing/malformed residual_score
  // to 0 ("low"), which would otherwise render a confident low-severity
  // badge on RiskDetailCard for a risk that was never actually scored --
  // same treatment RiskMatrixPage got for this bug class (#636).
  it("flags a risk with a malformed residual_score as unscored on the detail card", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site1", name: "Casablanca HQ" }] },
      isLoading: false,
    })
    setMatrixData({
      risks: [
        makeRisk({
          id: "risk-uuid-1",
          ref: "CYB-001",
          site_id: "site1",
          residual_score: "",
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    const populatedCells = screen.getAllByRole("button", {
      name: /^1 risk\(s\)/,
    })
    fireEvent.click(populatedCells[0])

    expect(
      screen.getByText("organization.riskMatrix.unscoredRiskBadge")
    ).toBeInTheDocument()
  })

  it("does not flag a risk with a genuinely valid residual_score as unscored", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site1", name: "Casablanca HQ" }] },
      isLoading: false,
    })
    setMatrixData({
      risks: [
        makeRisk({
          id: "risk-uuid-1",
          ref: "CYB-001",
          site_id: "site1",
          residual_score: 14,
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    const populatedCells = screen.getAllByRole("button", {
      name: /^1 risk\(s\)/,
    })
    fireEvent.click(populatedCells[0])

    expect(
      screen.queryByText("organization.riskMatrix.unscoredRiskBadge")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#549 (review round 1): BucketList's risk rows (Systemic
  // Buckets view) got the same Link treatment as RiskDetailCard above but
  // had no dedicated test -- a bucket only forms from >=2 risks sharing the
  // same category+site (see riskBuckets' bucketMap grouping), so this needs
  // its own fixture rather than reusing the single-risk one above.
  it("links a Systemic Bucket's risk rows to risk/site detail", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site1", name: "Casablanca HQ" }] },
      isLoading: false,
    })
    setMatrixData({
      risks: [
        makeRisk({
          id: "risk-uuid-1",
          ref: "CYB-001",
          name: "Cyberattaque ransomware",
          category: "cyber",
          site_id: "site1",
        }),
        makeRisk({
          id: "risk-uuid-2",
          ref: "CYB-002",
          name: "Data breach",
          category: "cyber",
          site_id: "site1",
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewBuckets",
      })
    )
    // The bucket's own toggle button is named `${categoryLabel} — ${site}`
    // (riskBuckets' bucketMap key), not a risk name -- "Casablanca HQ" is
    // the one substring guaranteed to appear in it given this fixture.
    await userEvent.click(
      screen.getByRole("button", { name: /Casablanca HQ/ })
    )

    const riskLink = screen.getByRole("link", {
      name: "Cyberattaque ransomware",
    })
    expect(riskLink).toHaveAttribute(
      "href",
      "/organization/risks/risk-uuid-1"
    )

    const siteLinks = screen.getAllByRole("link", { name: "Casablanca HQ" })
    expect(siteLinks[0]).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site1&search=Casablanca%20HQ"
    )
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
  // Regression (#393): the "Root cause" grouping mode was a non-functional
  // stub that labeled every risk "Simulated Root Cause" instead of doing
  // real grouping. It's been removed from the group-mode selector entirely
  // rather than left as a fake option users could pick.
  it("no longer offers the non-functional 'Root cause' grouping option", () => {
    setMatrixData({
      risks: [makeRisk({ id: "r1", ref: "CYB-001", category: "cyber" })],
    })

    render(<CorrelationMatrixPage />, withRouter)

    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.groupRootCause",
      })
    ).not.toBeInTheDocument()
  })

  it("resolves the selected cell's group-by-category label instead of the raw category string", async () => {
    setMatrixData({
      risks: [makeRisk({ id: "r1", ref: "CYB-001", category: "cyber" })],
    })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /^1 risk\(s\)/,
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
      risks: [makeRisk({ id: "r1", ref: "SUP-001", category: "supply_chain" })],
    })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /^1 risk\(s\)/,
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
    expect(screen.queryByText(/^supply_chain \(1\)$/)).not.toBeInTheDocument()
  })

  it("shows the Add Link control and existing links for ADMIN", () => {
    mockRole = "ADMIN"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />, withRouter)

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

    render(<CorrelationMatrixPage />, withRouter)

    expect(
      screen.getByText("organization.correlationMatrix.linkTypeAmplifies")
    ).toBeInTheDocument()
    expect(screen.queryByText("AMPLIFIES")).not.toBeInTheDocument()
  })

  // aexa-frontend#569: the Existing Links list showed each link's
  // source/target by ref as plain text, with no way to jump to the risk it
  // names, even though the page already loads the full risks array (the
  // same source RiskDetailCard/BucketList already use for #549's links).
  it("links a resolvable source/target ref to its risk, and leaves an unresolvable ref as plain text", () => {
    mockRole = "ADMIN"
    setMatrixData({
      risks: [
        makeRisk({ id: "risk-cyb", ref: "CYB-001" }),
        // Deliberately no risk for "OPS-002" -- link.source_ref stays
        // unresolved so the fallback-to-plain-text path is real, not
        // vacuous (every ref happening to resolve would hide a broken
        // lookup).
      ],
      riskLinks: [makeLink({ source_ref: "OPS-002", target_ref: "CYB-001" })],
    })

    render(<CorrelationMatrixPage />, withRouter)

    const link = screen.getByRole("link", { name: "CYB-001" })
    expect(link).toHaveAttribute("href", "/organization/risks/risk-cyb")

    expect(screen.getByText("OPS-002")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "OPS-002" })
    ).not.toBeInTheDocument()
  })

  it("hides the Add Link control and delete buttons for a non-privileged role", () => {
    mockRole = "VIEWER"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />, withRouter)

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

    render(<CorrelationMatrixPage />, withRouter)

    expect(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    ).toBeInTheDocument()
  })

  it("hides the Add Link control for LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    setMatrixData({ riskLinks: [makeLink()] })

    render(<CorrelationMatrixPage />, withRouter)

    expect(
      screen.queryByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    ).not.toBeInTheDocument()
  })

  // type=button sweep finding: 12 non-submit buttons across this file had
  // no explicit type, defaulting to type="submit" -- a real footgun since
  // this page also renders a real <form> (the "Add Link" form, further
  // down this same file) whose own Cancel/Submit buttons already declared
  // their type correctly; every OTHER button in the file is scoped here
  // rather than swept, since none of them sit inside that form and a full
  // sweep would need to separately re-verify every conditionally-rendered
  // button this page has (out of scope for this fix).
  it("gives every non-submit button an explicit type=\"button\", covering matrix toggles, a matrix cell, link add/delete, and both bucket views", async () => {
    mockRole = "LEAD_AUDITOR"
    setMatrixData({
      risks: [makeRisk()],
      riskLinks: [makeLink()],
      actions: [
        makeAction({ id: "a1", priority: "High" }),
        makeAction({
          id: "a2",
          priority: "High",
          actionTitle: "Unencrypted data",
        }),
      ],
    })
    mockRunRootCauseBucketing.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: {
            methodology: "PageRank clustering",
            riskBuckets: [],
            findingBuckets: [],
          },
        }),
    })

    render(<CorrelationMatrixPage />, withRouter)

    // Matrix-size, group-mode, view-mode toggles + a matrix cell.
    expect(
      screen.getByRole("button", { name: "5×5" }).getAttribute("type")
    ).toBe("button")
    expect(
      screen
        .getByRole("button", {
          name: "organization.correlationMatrix.groupAll",
        })
        .getAttribute("type")
    ).toBe("button")
    expect(
      screen
        .getByRole("button", {
          name: "organization.correlationMatrix.viewRisks",
        })
        .getAttribute("type")
    ).toBe("button")
    const cellButtons = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("h-16"))
    expect(cellButtons.length).toBeGreaterThan(0)
    cellButtons.forEach((b) => expect(b.getAttribute("type")).toBe("button"))

    // Add Link trigger + Delete Link.
    expect(
      screen
        .getByRole("button", {
          name: "organization.correlationMatrix.addLink",
        })
        .getAttribute("type")
    ).toBe("button")
    expect(
      screen
        .getByRole("button", {
          name: /organization\.correlationMatrix\.deleteLinkLabel/,
        })
        .getAttribute("type")
    ).toBe("button")

    // Findings-buckets view (real Action rows, "findings" view mode):
    // bucket toggle.
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )
    expect(
      screen
        .getByText("organization.findings.priorityHigh priority")
        .closest("button")!
        .getAttribute("type")
    ).toBe("button")

    // AI-buckets view: run-analysis button.
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewAiBuckets",
      })
    )
    expect(
      screen
        .getByRole("button", {
          name: "organization.correlationMatrix.aiRunAnalysis",
        })
        .getAttribute("type")
    ).toBe("button")
  })

  // AI risk-bucket toggle + "Send to Finding" button, via the shared helper.
  it("gives the AI risk-bucket toggle and Send to Finding button an explicit type=\"button\"", async () => {
    mockRole = "LEAD_AUDITOR"
    await renderWithExpandedAiBucket()

    const toggleButton = screen
      .getByText("Supplier concentration")
      .closest("button")
    expect(toggleButton?.getAttribute("type")).toBe("button")

    expect(
      screen
        .getByRole("button", {
          name: "organization.correlationMatrix.sendToFinding",
        })
        .getAttribute("type")
    ).toBe("button")
  })

  it("rejects a self-referencing link client-side without calling the mutation", async () => {
    setMatrixData({
      risks: [makeRisk({ id: "r1", ref: "CYB-001" })],
    })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )
    await userEvent.selectOptions(
      screen.getByLabelText(
        "organization.correlationMatrix.linkFormSourceLabel"
      ),
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

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )

    await userEvent.selectOptions(
      screen.getByLabelText(
        "organization.correlationMatrix.linkFormSourceLabel"
      ),
      "CYB-001"
    )
    await userEvent.selectOptions(
      screen.getByLabelText(
        "organization.correlationMatrix.linkFormTargetLabel"
      ),
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

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.addLink",
      })
    )
    await userEvent.selectOptions(
      screen.getByLabelText(
        "organization.correlationMatrix.linkFormSourceLabel"
      ),
      "CYB-001"
    )
    await userEvent.selectOptions(
      screen.getByLabelText(
        "organization.correlationMatrix.linkFormTargetLabel"
      ),
      "OPS-002"
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.linkFormSubmit",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "This risk link already exists"
      )
    )
  })

  it("opens a delete confirmation and deletes the link on confirm", async () => {
    mockDeleteRiskLink.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeLink() }),
    })
    setMatrixData({ riskLinks: [makeLink({ id: "link-42" })] })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    )
    // Previously this deleted immediately on the first click -- it now
    // routes through the shared DeleteAlertModal like every other delete
    // action in this codebase, so the mutation must not fire until confirm.
    expect(mockDeleteRiskLink).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockDeleteRiskLink).toHaveBeenCalledWith("link-42")
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows a toast with the real error message when link deletion fails", async () => {
    mockDeleteRiskLink.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Risk link not found" } }),
    })
    setMatrixData({ riskLinks: [makeLink({ id: "link-42" })] })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    )
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Risk link not found")
    )
  })

  // Same discarded-isLoading double-submission bug fixed for
  // RiskRegisterPage/aexa-frontend#620 -- useDeleteRiskLinkMutation's
  // isLoading was previously discarded, and this delete action had no
  // confirmation modal at all (it fired immediately on click). Now routes
  // through DeleteAlertModal, so the same loading-disable behavior applies.
  it("disables the delete confirmation button while a delete is already in flight", async () => {
    setMatrixData({ riskLinks: [makeLink({ id: "link-42" })] })
    mockIsDeletingLink = true

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    )

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeDisabled()
  })

  // Round-1 adversarial review of this PR: this is a genuinely new
  // behavioral surface (deletion previously fired immediately on click,
  // with no way to back out) -- verifies Cancel actually closes the modal
  // without ever calling the mutation, not just that Confirm does.
  it("does not delete the link when the confirmation is cancelled", async () => {
    setMatrixData({ riskLinks: [makeLink({ id: "link-42" })] })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /organization\.correlationMatrix\.deleteLinkLabel/,
      })
    )
    await userEvent.click(
      screen.getByRole("button", { name: /cancel delete/i })
    )

    expect(mockDeleteRiskLink).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", { name: /confirm delete/i })
    ).not.toBeInTheDocument()
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

    const { rerender } = render(<CorrelationMatrixPage />, withRouter)
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

  // quality-bar-loop round 7 (industry-standards, round-6 review finding):
  // round 6's link to the real PageRank network view only lived inside the
  // AI Buckets tab -- a user who never opens that tab never sees a pointer
  // to the real interconnection metric. A header-level link is visible
  // regardless of which of the four view modes is active.
  it("links to the full network analysis from the page header, regardless of the active tab", () => {
    render(<CorrelationMatrixPage />, withRouter)

    // Default tab is "risks", not "ai-buckets" -- the header link must
    // still be present without switching tabs.
    const link = screen.getByRole("link", {
      name: "organization.correlationMatrix.viewFullNetworkAnalysis",
    })
    expect(link).toHaveAttribute("href", "/organization/risk-graph")
  })

  // Round 7's second review pass: the AI Buckets tab used to carry its own
  // (now-removed) copy of this same link, which became a duplicate once the
  // header link covered every tab. Only one instance should ever render at
  // a time -- a regression here would mean the in-tab copy silently crept
  // back in alongside the header one.
  it("does not duplicate the network-analysis link when the AI Buckets tab is active", async () => {
    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewAiBuckets",
      })
    )

    const links = screen.getAllByRole("link", {
      name: "organization.correlationMatrix.viewFullNetworkAnalysis",
    })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute("href", "/organization/risk-graph")
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

    render(<CorrelationMatrixPage />, withRouter)

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

    render(<CorrelationMatrixPage />, withRouter)

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

  // quality-bar-loop round 5 (visual polish, round-1 finding): the
  // root-cause/action info chips used bg-*-500/10 + text-*-700 with no
  // dark: variant, producing a muddy, low-contrast pairing in dark
  // mode. Now use the shared INFO_CHIP_AMBER/INFO_CHIP_BLUE constants
  // which add dark:bg-*-400/15 + dark:text-*-400.
  it("gives the root-cause and action info chips dark-mode-aware contrast classes", async () => {
    await renderWithExpandedAiBucket()

    const rootCauseChip = screen.getByText(
      "organization.correlationMatrix.aiRootCauseLabel"
    )
    expect(rootCauseChip.className).toContain("dark:bg-amber-400/15")
    expect(rootCauseChip.className).toContain("dark:text-amber-400")

    const actionChip = screen.getByText(
      "organization.correlationMatrix.aiActionLabel"
    )
    expect(actionChip.className).toContain("dark:bg-blue-400/15")
    expect(actionChip.className).toContain("dark:text-blue-400")
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
          data: {
            message: "Risk ref(s) not found in this organization: OPS-999",
          },
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

    render(<CorrelationMatrixPage />, withRouter)
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

    render(<CorrelationMatrixPage />, withRouter)
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
        makeAction({
          id: "a2",
          priority: "High",
          actionTitle: "Unencrypted data",
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )

    expect(
      screen.getByText("organization.findings.priorityHigh priority")
    ).toBeInTheDocument()
  })

  // Regression (#394): the findings-view bucket name interpolated the raw
  // f.priority value ("High"/"Low") straight into the i18n string instead of
  // routing it through the same PRIORITY_KEYS map used for the individual
  // finding badges below -- so a French UI showed "Priorité High" instead of
  // the translated word. Asserting the bucket name renders the translated
  // organization.findings.priorityHigh key (not the raw "High" literal)
  // proves the fix.
  it("translates the finding priority in the bucket name instead of leaking the raw priority value", () => {
    setMatrixData({
      actions: [
        makeAction({ id: "a1", priority: "High" }),
        makeAction({
          id: "a2",
          priority: "High",
          actionTitle: "Unencrypted data",
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )

    expect(screen.queryByText("High priority")).not.toBeInTheDocument()
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

    render(<CorrelationMatrixPage />, withRouter)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )
    fireEvent.click(
      screen.getByText("organization.findings.priorityHigh priority")
    )

    const badges = await screen.findAllByText(
      "organization.findings.priorityHigh"
    )
    expect(badges).toHaveLength(2)
    expect(
      screen.queryAllByText((_, el) => el?.textContent === "High")
    ).toHaveLength(0)
    for (const badge of badges) {
      expect(badge).toHaveClass("bg-orange-500/15")
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

    render(<CorrelationMatrixPage />, withRouter)

    fireEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )
    fireEvent.click(
      screen.getByText("organization.findings.priorityLow priority")
    )

    const badges = await screen.findAllByText(
      "organization.findings.priorityLow"
    )
    expect(badges).toHaveLength(2)
    for (const badge of badges) {
      expect(badge).toHaveClass("bg-emerald-500/15")
      expect(badge).not.toHaveClass("bg-orange-500/15")
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
        ...sources.map((s) =>
          makeLink({ source_ref: s.ref, target_ref: target.ref })
        ),
        ...dests.map((d) =>
          makeLink({ source_ref: target.ref, target_ref: d.ref })
        ),
      ],
    })
  }

  it("resets selectedCell when matrixSize changes, instead of showing a raw {{...}} placeholder for an out-of-range cell", async () => {
    setCornerCellMatrixData()
    render(<CorrelationMatrixPage />, withRouter)

    // The (row 4, col 4) corner cell holds exactly TGT-001 (4 root causes,
    // 4 consequences) -- select it.
    await userEvent.click(
      screen.getByRole("button", {
        name: /^1 risk\(s\)/,
      })
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
    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: /^1 risk\(s\)/,
      })
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

  // aexa-frontend#376 -- the "Group by Category/Site" bucket list's impact
  // total had no regression coverage, unlike RiskRegisterPage/RiskGraphPage's
  // equivalent fixes. bucket.totalImpact sums financial_impact_max values,
  // which are stored in k€ (per the risk form's own "k€" label, submitted
  // unmodified); rendering divides by 1,000 for M€, not 1,000,000.
  it("aexa-frontend#376: sums bucket financial impact in M€ from stored k€ units", async () => {
    setMatrixData({
      risks: [
        makeRisk({
          id: "risk-1",
          ref: "CYB-001",
          category: "cyber",
          site_id: "site1",
          financial_impact_max: 300000,
        }),
        makeRisk({
          id: "risk-2",
          ref: "CYB-002",
          category: "cyber",
          site_id: "site1",
          financial_impact_max: 200000,
        }),
      ],
    })

    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewBuckets",
      })
    )

    // 300,000 + 200,000 = 500,000 k€ / 1,000 = 500.0M€. Dividing by
    // 1,000,000 instead would render "0.5M€", a 1000x understatement.
    expect(screen.getByText(/500.0M€/)).toBeInTheDocument()
    expect(screen.queryByText(/0\.5M€/)).not.toBeInTheDocument()
  })

  // aexa-frontend#473 -- all 25 (5x5) matrix-cell buttons had no aria-label
  // at all; a zero-risk cell rendered with a completely empty accessible
  // name (its only visible content -- the count badge -- is conditional on
  // cellRisks.length > 0).
  it("gives every matrix cell button a non-empty accessible name, including empty (zero-risk) cells", () => {
    setMatrixData({
      risks: [makeRisk({ id: "r1", ref: "CYB-001" })],
      riskLinks: [],
    })
    render(<CorrelationMatrixPage />, withRouter)

    // 5x5 default matrix = 25 cells.
    const cellButtons = screen
      .getAllByRole("button")
      .filter((btn) => /^\d+ risk\(s\) —/.test(btn.getAttribute("aria-label") || ""))
    expect(cellButtons).toHaveLength(25)
    cellButtons.forEach((btn) => {
      expect(btn.getAttribute("aria-label")).not.toBe("")
    })
  })

  // aexa-frontend#473 -- the finding-bucket, category-bucket, and both AI
  // bucket-card collapsible toggles switched chevron icons on click but
  // never exposed their expanded/collapsed state to assistive tech.
  it("reflects a finding-bucket toggle's open/closed state via aria-expanded", async () => {
    setMatrixData({
      actions: [
        makeAction({ id: "a1", priority: "High" }),
        makeAction({ id: "a2", priority: "High" }),
      ],
    })
    render(<CorrelationMatrixPage />, withRouter)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.correlationMatrix.viewFindings",
      })
    )
    // findingPriorityBucketName is one of this test file's real-interpolation
    // overrides (see the top-of-file t() mock) -- it renders as "High
    // priority", not the raw key.
    const toggle = screen.getByRole("button", { name: /High priority/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
  })

  // aexa-frontend#473 -- h1 used to be followed directly by h3s (and those
  // by h4s) with no h2 in between, breaking heading-level order for
  // screen-reader users.
  it("has an h2 between the page h1 and its h3/h4 section headings", () => {
    render(<CorrelationMatrixPage />, withRouter)

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { level: 2 }).length
    ).toBeGreaterThan(0)
  })
})
