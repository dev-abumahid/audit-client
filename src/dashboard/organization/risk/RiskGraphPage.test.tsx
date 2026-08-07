import { fireEvent, render, screen, within } from "@testing-library/react"
import type React from "react"
import { MemoryRouter } from "react-router"
import { toast } from "sonner"
import RiskGraphPage from "./RiskGraphPage"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// aexa-frontend#550: the selected-risk detail heading is now a real <Link>,
// so every render() needs a Router context.
const withRouter = { wrapper: MemoryRouter }

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetCorrelationMatrixDataQuery = vi.fn()

// react-i18next's real t() falls back to returning the raw key with no
// I18nextProvider in the tree, which every other assertion in this file
// relies on. pagerankAbbrLabel is special-cased to its real English value
// ("PR:") since the node-label tests below assert the rendered "PR:<n>"
// text, same pattern as RiskMatrixPage.test.tsx. nodeAriaLabel is likewise
// special-cased to interpolate {{riskId}} (aexa-frontend#575's fix passes
// risk.ref there, not risk.id -- a test needs the real interpolated value
// to tell those apart, which the raw-key fallback below can't provide).
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === "organization.riskGraph.pagerankAbbrLabel") {
          return "PR:"
        }
        if (key === "organization.riskGraph.nodeAriaLabel") {
          return `Risk ${params?.riskId ?? ""}`
        }
        return key
      },
      i18n: { language: "en" },
    }),
  }
})

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
}))

vi.mock("@/redux/apis/organization/riskLink.api", () => ({
  useGetCorrelationMatrixDataQuery: (...args: unknown[]) =>
    mockUseGetCorrelationMatrixDataQuery(...args),
}))

// SiteFilter independently calls useGetAllSitesQuery -- stubbed out so this
// test file stays scoped to RiskGraphPage's own data wiring, same pattern
// Overview.test.tsx uses for CriticalAlertBanner. Captures the onChange prop
// so tests can simulate a site-filter change (e.g. the zoom-reset test
// below) without needing to render SiteFilter's own real dropdown UI.
let capturedSiteFilterOnChange: ((next: string | null) => void) | null = null
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: (props: { onChange: (next: string | null) => void }) => {
    capturedSiteFilterOnChange = props.onChange
    return null
  },
}))

// Radix DropdownMenu needs pointer-capture APIs jsdom doesn't implement --
// same pattern CompliancePage.test.tsx uses. Content is rendered
// unconditionally (no open/closed simulation) so the export menu items are
// directly queryable without needing to click the trigger first.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
  }) => <button onClick={onClick}>{children}</button>,
}))

function makeRisk(overrides = {}) {
  return {
    id: "risk-real-1",
    ref: "RSK-001",
    org_account_id: "org-1",
    name: "Supply Chain Disruption",
    description: "Delays in raw material delivery",
    category: "supply_chain",
    inherent_score: 20,
    residual_score: 5,
    pagerank_score: 42,
    financial_impact_min: 50000,
    financial_impact_max: 200000,
    probability: 0.6,
    velocity: "Medium",
    trend: "Increasing",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site-1",
    control_design_eff: 0,
    control_operating_eff: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("RiskGraphPage", () => {
  beforeEach(() => {
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReset()
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { riskLinks: [] } },
      isLoading: false,
    })
  })

  it("shows a loading state while risks are loading", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<RiskGraphPage />, withRouter)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while the correlation graph (used for the real tipping-point PageRank) is loading", () => {
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<RiskGraphPage />, withRouter)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders real risk refs as graph nodes, not the old mock fixture ids", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ ref: "RSK-001" })] },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // Short refs fit inside the node, so the SVG <text> label renders it in
    // full.
    const matches = screen.getAllByText("RSK-001")
    expect(matches.some((el) => el.tagName.toLowerCase() === "text")).toBe(true)
    expect(screen.queryByText("risk_fire")).not.toBeInTheDocument()
  })

  // aexa-frontend#575: node labels used to be shortRef(risk.id) -- the
  // opaque uuid, not the human-readable ref every other part of this page
  // (domino chains, correlations list, cascade summary) and every sibling
  // risk page already keys on. Never noticed because the page had only ever
  // been exercised with 1-2 risks; load-testing with 80+ risks made the
  // uuid-prefix labels' illegibility obvious.
  it("truncates a full-length ref in the node label but shows the full ref and name in a tooltip", () => {
    const longRef = "SUP-STRESS-TEST-0001"
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ ref: longRef, name: "Supply Chain Disruption" })],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // The visible node label is truncated to the first 8 chars of the ref...
    const label = screen.getByText("SUP-STRE")
    expect(label.tagName.toLowerCase()).toBe("text")
    // ...while the full ref and name are preserved in the <title> tooltip.
    const tooltip = screen.getByText(
      (_, el) =>
        el?.tagName.toLowerCase() === "title" &&
        el.textContent === `${longRef} — Supply Chain Disruption`
    )
    expect(tooltip).toBeInTheDocument()
  })

  // aexa-frontend#575: the node's accessible name interpolated risk.id (a
  // uuid a screen-reader user has no way to act on) instead of risk.ref.
  it("gives a graph node an accessible name built from its ref, not its uuid id", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ id: "risk-real-1", ref: "RSK-001" })],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    expect(
      screen.getByRole("button", { name: "Risk RSK-001" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Risk risk-real-1" })
    ).not.toBeInTheDocument()
  })

  it("aexa-frontend#376: shows selected risk's max impact as M€ from its stored k€ units", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ ref: "RSK-001", financial_impact_max: 500000 })],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const nodeLabel = screen
      .getAllByText("RSK-001")
      .find((el) => el.tagName.toLowerCase() === "text")!
    await userEvent.click(nodeLabel)

    // The Min/Max Impact form fields are labeled "k€" and submitted
    // unmodified, so the stored value is already in k€: 500,000 k€ / 1,000
    // = 500.0M€. Dividing by 1,000,000 instead (as aexa-frontend#236's fix
    // previously did) understated every figure 1000x, rendering "0.5M€" for
    // what should have read "500.0M€". The value and "M€" suffix render as
    // separate text nodes within the same <p>, so match on the element's
    // combined textContent rather than getByText's per-node text.
    expect(
      screen.getByText((_, el) => el?.textContent === "500.0M€")
    ).toBeInTheDocument()
  })

  // aexa-frontend#550: the side panel's "id — name" heading was plain text
  // even though selectedRiskData.id was already available -- same gap
  // #548/#549 fixed on the risk-matrix pages. aexa-frontend#575: the
  // visible label switched from the uuid id to the human-readable ref
  // (matching every sibling page's equivalent heading), while the link
  // target keeps using the uuid id, since that's the real route param.
  it("links the selected risk's side-panel heading to its detail page", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "risk-real-1",
            ref: "RSK-001",
            name: "Supply Chain Disruption",
          }),
        ],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const nodeLabel = screen
      .getAllByText("RSK-001")
      .find((el) => el.tagName.toLowerCase() === "text")!
    await userEvent.click(nodeLabel)

    const link = screen.getByRole("link", {
      name: "RSK-001 — Supply Chain Disruption",
    })
    expect(link).toHaveAttribute("href", "/organization/risks/risk-real-1")
  })

  it("shows zero correlations when the org genuinely has no RiskLink rows yet", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "risk-real-1" }),
          makeRisk({ id: "risk-real-2" }),
        ],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // t() echoes the key in the test env (i18n is not initialized in setup).
    expect(
      screen.getByText("organization.riskGraph.correlations (0)")
    ).toBeInTheDocument()
  })

  // aexa-frontend#473 -- `links` used to be hardcoded to a module-level
  // empty array regardless of real data, so the Domino Scenarios /
  // Corrélations panels could never show anything. correlationMatrixResponse
  // was already being fetched in this exact component (for the PageRank
  // computation covered by the tests above) -- it's now the single source
  // for the graph's edges too.
  it("renders real RiskLink rows as graph edges and in the Correlations list, not an empty fixture", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-hub", ref: "RISK-HUB" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            {
              source_ref: "RISK-A",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    expect(
      screen.getByText("organization.riskGraph.correlations (1)")
    ).toBeInTheDocument()
    // RISK-A/RISK-HUB are short (<=12 chars) so shortRef renders them
    // untruncated in the Correlations list row.
    expect(screen.getAllByText("RISK-A").length).toBeGreaterThan(0)
    expect(screen.getAllByText("RISK-HUB").length).toBeGreaterThan(0)
  })

  // aexa-frontend#570: the Links list's source/target refs were plain text
  // even though the page already resolves refs to risks elsewhere (the
  // selected-risk side panel above, #550) -- reuses the same lookup.
  it("links the Links list's source/target refs to their risk detail pages", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-hub", ref: "RISK-HUB" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            {
              source_ref: "RISK-A",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const sourceLink = screen.getByRole("link", { name: "RISK-A" })
    expect(sourceLink).toHaveAttribute("href", "/organization/risks/node-a")

    const targetLink = screen.getByRole("link", { name: "RISK-HUB" })
    expect(targetLink).toHaveAttribute("href", "/organization/risks/node-hub")
  })

  // RiskLink.source_ref/target_ref reference risks by their human-readable
  // `ref` (e.g. "RISK-A"), never their uuid `id` -- confirmed against
  // CorrelationMatrixPage.tsx's own identical filteredRefs, the page already
  // correctly rendering these same links. Wiring `links` to real data
  // without also switching the graph's internal id/ref keying (positions,
  // cascadeRefs, selectedRisk, dominoChains) would leave every edge
  // undrawable -- source/target uuids would never match a `ref`-keyed
  // `positions` entry. This exercises the full click -> cascade path to
  // catch that class of bug, not just "an edge count renders".
  it("resolves risk-link refs to real graph nodes for cascade selection, not their uuid ids", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "uuid-a", ref: "RISK-A" }),
          makeRisk({ id: "uuid-hub", ref: "RISK-HUB" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            {
              source_ref: "RISK-A",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // The graph node's visible label is shortRef(risk.ref) ("RISK-A") --
    // clicking it exercises setSelectedRisk(risk.ref) internally.
    const nodeALabel = screen
      .getAllByText("RISK-A")
      .find((el) => el.tagName.toLowerCase() === "text")!
    await userEvent.click(nodeALabel)

    // Selecting RISK-A cascades into RISK-HUB via the CAUSES link -- only
    // reachable if the link's ref-space source/target actually resolved to
    // real node positions/selection state (cascadeRefs, positions,
    // selectedRiskData are all keyed by ref, per the fix above). The side
    // panel's header shows the selected risk's ref and name. The same
    // "ref — name" text also appears in the node's own <title> tooltip, so
    // scope to the heading link specifically.
    const headingMatches = screen.getAllByText(
      "RISK-A — Supply Chain Disruption"
    )
    expect(headingMatches.some((el) => el.closest("h3") !== null)).toBe(true)
    expect(screen.getAllByText(/RISK-HUB/).length).toBeGreaterThan(0)
  })

  // aexa-frontend#397: the legend's "Tipping Point" entry used to be dead --
  // no rendering logic ever applied it to a node. It now marks the top 15% of
  // risks by real PageRank over the org's actual RiskLink correlation graph
  // (same methodology/threshold as Overview.tsx's "Systemic Tipping Points"
  // section, aexa-frontend#25) -- not Risk.pagerank_score, which is a
  // manually-entered form field with no real centrality meaning.
  it("marks the risk with multiple inbound correlation links as the tipping point, not an isolated risk", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-b", ref: "RISK-B" }),
          makeRisk({ id: "node-hub", ref: "RISK-HUB" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            {
              source_ref: "RISK-A",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
            {
              source_ref: "RISK-B",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const hubLabel = screen
      .getAllByText("RISK-HUB")
      .find((el) => el.tagName.toLowerCase() === "text")!
    const hubGroup = hubLabel.closest("g") as unknown as HTMLElement
    expect(
      within(hubGroup).getByTitle("organization.riskGraph.legendTippingPoint")
    ).toBeInTheDocument()

    const isolatedLabel = screen
      .getAllByText("RISK-A")
      .find((el) => el.tagName.toLowerCase() === "text")!
    const isolatedGroup = isolatedLabel.closest("g") as unknown as HTMLElement
    expect(
      within(isolatedGroup).queryByTitle(
        "organization.riskGraph.legendTippingPoint"
      )
    ).not.toBeInTheDocument()
  })

  it("still surfaces at least one tipping point when there's no correlation link data yet, matching Overview.tsx's own minimum-one guarantee", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-b", ref: "RISK-B" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { riskLinks: [] } },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // One Zap icon in the legend, plus exactly one on a node badge.
    expect(document.querySelectorAll(".lucide-zap")).toHaveLength(2)
  })

  // Regression (issue #422): node sizing, the "PR:" node label, and the
  // side-panel PageRank field used to read the fake manually-entered
  // risk.pagerank_score field instead of the real computed PageRank (the
  // same computePageRank/buildRiskCorrelationEdges result already used
  // correctly for the tipping-point badge above). Give the hub -- which
  // has the most real inbound correlation links, so the highest real
  // PageRank -- a deliberately low fake pagerank_score, and an isolated
  // node a deliberately high one, then assert the rendered labels track
  // the real computed rank, not the fake field.
  it("labels graph nodes with the real computed PageRank, not the fake pagerank_score field", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A", pagerank_score: 999 }),
          makeRisk({ id: "node-b", ref: "RISK-B", pagerank_score: 999 }),
          makeRisk({ id: "node-hub", ref: "RISK-HUB", pagerank_score: 3 }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            {
              source_ref: "RISK-A",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
            {
              source_ref: "RISK-B",
              target_ref: "RISK-HUB",
              link_type: "CAUSES",
            },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // The hub has the highest real PageRank (two inbound links), so once
    // normalized against the graph's max score it renders "PR:100" despite
    // its fake pagerank_score of 3.
    const hubLabel = screen
      .getAllByText("RISK-HUB")
      .find((el) => el.tagName.toLowerCase() === "text")!
    const hubGroup = hubLabel.closest("g") as unknown as HTMLElement
    expect(within(hubGroup).getByText("PR:100")).toBeInTheDocument()
    expect(within(hubGroup).queryByText("PR:3")).not.toBeInTheDocument()

    // RISK-A has no inbound links, so its real PageRank is below the hub's
    // -- it must not render the fake pagerank_score of 999.
    const nodeALabel = screen
      .getAllByText("RISK-A")
      .find((el) => el.tagName.toLowerCase() === "text")!
    const nodeAGroup = nodeALabel.closest("g") as unknown as HTMLElement
    expect(within(nodeAGroup).queryByText("PR:999")).not.toBeInTheDocument()

    // Selecting the hub node shows the same real, normalized PageRank
    // ("100") in the side panel's field explicitly labeled "PageRank".
    await userEvent.click(hubLabel)
    const pageRankPanel = screen
      .getByText("organization.riskGraph.pageRank")
      .closest("div") as HTMLElement
    expect(within(pageRankPanel).getByText("100")).toBeInTheDocument()
  })

  // aexa-frontend#473 -- the Domino Scenarios toggle switched icons on
  // click but never exposed its expanded/collapsed state to assistive tech.
  it("reflects the Domino Scenarios panel's open/closed state via aria-expanded", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    render(<RiskGraphPage />, withRouter)

    const toggle = screen.getByRole("button", {
      name: /organization\.riskGraph\.dominoScenarios/,
    })
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  // aexa-frontend#577 round 7: the domino-chain DFS used to start a fresh
  // traversal from every node with an outgoing CAUSES/AMPLIFIES link, not
  // just true roots -- on a linear chain A->B->C->D that reported the same
  // causal chain twice ([A,B,C,D] from A, and the redundant suffix [B,C,D]
  // from B), needlessly duplicating a real chain and wasting DFS work that
  // gets much more expensive on a densely-linked graph. Restricting starts
  // to nodes with no incoming link fixes this without losing coverage: any
  // chain starting mid-graph is a (lower-impact) suffix of its root's chain.
  it("restricts the domino-chain DFS to true roots so a linear causal chain is reported once, not once per intermediate node", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "a", ref: "RISK-A" }),
          makeRisk({ id: "b", ref: "RISK-B" }),
          makeRisk({ id: "c", ref: "RISK-C" }),
          makeRisk({ id: "d", ref: "RISK-D" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            { source_ref: "RISK-A", target_ref: "RISK-B", link_type: "CAUSES" },
            { source_ref: "RISK-B", target_ref: "RISK-C", link_type: "CAUSES" },
            { source_ref: "RISK-C", target_ref: "RISK-D", link_type: "CAUSES" },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const toggle = screen.getByRole("button", {
      name: /organization\.riskGraph\.dominoScenarios/,
    })
    expect(toggle).toHaveTextContent("(1)")
  })

  // aexa-frontend#577 round 7: the DFS had no depth limit, only per-path
  // cycle avoidance -- a single long causal chain (independent of any
  // branching) could traverse the entire graph. MAX_CHAIN_DEPTH bounds any
  // one chain's length; a chain longer than the cap is still reported
  // (truncated), not silently dropped.
  it("truncates a domino chain at the depth cap instead of exploring the full causal chain", () => {
    const refs = Array.from({ length: 11 }, (_, i) => `RISK-${i + 1}`)
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: refs.map((ref) => makeRisk({ id: ref, ref })),
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: refs.slice(0, -1).map((ref, i) => ({
            source_ref: ref,
            target_ref: refs[i + 1],
            link_type: "CAUSES",
          })),
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const toggle = screen.getByRole("button", {
      name: /organization\.riskGraph\.dominoScenarios/,
    })
    expect(toggle).toHaveTextContent("(1)")

    const dominoPanel = toggle.closest(".rounded-xl") as HTMLElement
    const refButtons = within(dominoPanel).getAllByTitle(/^RISK-\d+$/)
    expect(refButtons).toHaveLength(8)
  })

  // aexa-frontend#577 round 7: a wide (high branching factor), deep causal
  // graph can blow up combinatorially even within the depth cap above (e.g.
  // 8 levels at branching factor 4 is 4^7 ~ 16,384 paths per root) --
  // MAX_PATHS_EXPLORED bounds total DFS work regardless of graph shape, so
  // this must render promptly instead of hanging the page.
  it("stays responsive on a densely-linked causal graph via the path-exploration budget", () => {
    // Depth is already bounded to MAX_CHAIN_DEPTH (8) regardless of LAYERS,
    // so branching alone must be enough to matter: 8 wide x 7 remaining
    // levels after the root is ~8^7 ~ 2,097,152 paths per root, x8 roots ~
    // 16.8M -- without the budget this either times out this test (Vitest's
    // default 5s) or takes many seconds; with it, this must stay fast. A
    // narrower graph wouldn't actually exercise the budget: dominoChains is
    // unconditionally .slice(0, 5)'d, so a chain-count assertion alone can't
    // tell "the budget capped this" apart from "there just weren't many
    // paths" -- the wall-clock assertion below is what actually tests it.
    const LAYERS = 9
    const WIDTH = 8
    const risks = []
    const riskLinks = []
    for (let layer = 0; layer < LAYERS; layer++) {
      for (let node = 0; node < WIDTH; node++) {
        const ref = `L${layer}-${node}`
        risks.push(makeRisk({ id: ref, ref }))
        if (layer > 0) {
          for (let prevNode = 0; prevNode < WIDTH; prevNode++) {
            riskLinks.push({
              source_ref: `L${layer - 1}-${prevNode}`,
              target_ref: ref,
              link_type: "CAUSES",
            })
          }
        }
      }
    }
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: risks },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: { data: { riskLinks } },
      isLoading: false,
    })

    const start = performance.now()
    render(<RiskGraphPage />, withRouter)
    const elapsed = performance.now() - start

    // The budget's whole point is bounding total DFS work to a constant --
    // this graph's unbounded path count (~16.8M) would take vastly longer
    // than this without it.
    expect(elapsed).toBeLessThan(2000)

    const toggle = screen.getByRole("button", {
      name: /organization\.riskGraph\.dominoScenarios/,
    })
    // Still bounded to the top-5 chains regardless of how many the budget
    // let it explore.
    expect(toggle).toHaveTextContent(/\((?:[0-5])\)/)
  })

  // aexa-frontend#577 round 7 review: the root-restriction above assumes a
  // chain's total impact only ever grows as it extends, which is only true
  // if financial_impact_max can't be negative -- but the form has no
  // min/validate rule on it (a plain number field), so a saved risk really
  // can carry one. Without clamping each node's contribution to >= 0, a
  // root's real chain (e.g. R(-1000) -> A(50) -> B(50) -> C(50)) could sum
  // to less than a mid-graph suffix the root-restriction now skips
  // exploring (A -> B -> C, without R's negative value dragging it down),
  // silently reporting the wrong (or a negative-total) chain.
  it("clamps a negative financial_impact_max to 0 so a root's real chain isn't scored below what a skipped mid-graph suffix would have been", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "root",
            ref: "RISK-ROOT",
            financial_impact_max: -1000000,
          }),
          makeRisk({ id: "a", ref: "RISK-A", financial_impact_max: 200000 }),
          makeRisk({ id: "b", ref: "RISK-B", financial_impact_max: 200000 }),
          makeRisk({ id: "c", ref: "RISK-C", financial_impact_max: 200000 }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            {
              source_ref: "RISK-ROOT",
              target_ref: "RISK-A",
              link_type: "CAUSES",
            },
            { source_ref: "RISK-A", target_ref: "RISK-B", link_type: "CAUSES" },
            { source_ref: "RISK-B", target_ref: "RISK-C", link_type: "CAUSES" },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const toggle = screen.getByRole("button", {
      name: /organization\.riskGraph\.dominoScenarios/,
    })
    expect(toggle).toHaveTextContent("(1)")

    const dominoPanel = toggle.closest(".rounded-xl") as HTMLElement
    // The root's real chain (all 4 refs) is still found, and its total
    // (600.0M€ = 0 clamped + 200k*3, in k€) is never negative despite the
    // root's -1000000 raw value.
    expect(
      within(dominoPanel)
        .getAllByTitle(/^RISK-/)
        .map((el) => el.title)
    ).toEqual(["RISK-ROOT", "RISK-A", "RISK-B", "RISK-C"])
    expect(within(dominoPanel).getByText("600.0M€")).toBeInTheDocument()
  })

  // aexa-frontend#577 round 7 review: restricting DFS starts to nodes with
  // no incoming link misses a real chain when a cycle has no true root of
  // its own but still has an acyclic exit -- e.g. A->B->C->A (a closed
  // loop, so A/B/C all have an incoming link and none qualifies as a root)
  // plus C->D (a real, non-cyclic terminus). The old pre-root-restriction
  // DFS found this by starting from every outgoing-edge node; a naive
  // root-only restriction would silently drop it. The second DFS pass
  // (starting from any outgoing-edge node no root's traversal ever reached)
  // exists specifically to catch this.
  it("still finds the acyclic tail past a cycle that has no true root of its own", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "a", ref: "RISK-A" }),
          makeRisk({ id: "b", ref: "RISK-B" }),
          makeRisk({ id: "c", ref: "RISK-C" }),
          makeRisk({ id: "d", ref: "RISK-D" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            { source_ref: "RISK-A", target_ref: "RISK-B", link_type: "CAUSES" },
            { source_ref: "RISK-B", target_ref: "RISK-C", link_type: "CAUSES" },
            { source_ref: "RISK-C", target_ref: "RISK-A", link_type: "CAUSES" },
            { source_ref: "RISK-C", target_ref: "RISK-D", link_type: "CAUSES" },
          ],
        },
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const toggle = screen.getByRole("button", {
      name: /organization\.riskGraph\.dominoScenarios/,
    })
    expect(toggle).toHaveTextContent("(1)")

    const dominoPanel = toggle.closest(".rounded-xl") as HTMLElement
    expect(
      within(dominoPanel)
        .getAllByTitle(/^RISK-/)
        .map((el) => el.title)
    ).toEqual(["RISK-A", "RISK-B", "RISK-C", "RISK-D"])
  })

  // aexa-frontend#473 -- h1 used to be followed directly by h3s with no h2
  // in between, breaking heading-level order for screen readers.
  it("has an h2 between the page h1 and its h3 section headings", () => {
    render(<RiskGraphPage />, withRouter)

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(
      0
    )
  })

  // aexa-frontend#497 -- graph nodes were plain <g onClick> elements with no
  // tabIndex/role/onKeyDown, making risk selection (and cascade/domino
  // detail) entirely unreachable via keyboard.
  it("makes a graph node keyboard-selectable via role=button, tabIndex, and Enter/Space", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-real-1" })] },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const node = screen.getByRole("button", { name: /^Risk / })
    expect(node.tagName.toLowerCase()).toBe("g")
    expect(node).toHaveAttribute("tabindex", "0")
    expect(node).toHaveAttribute("aria-pressed", "false")

    node.focus()
    await userEvent.keyboard("{Enter}")
    expect(node).toHaveAttribute("aria-pressed", "true")

    await userEvent.keyboard(" ")
    expect(node).toHaveAttribute("aria-pressed", "false")
  })

  // aexa-frontend#575 review: with 80+ risks on the graph there was no way
  // to find a specific one except visually hunting the canvas.
  describe("search (#575 review)", () => {
    it("shows matching risks by ref or name as the user types, and selects one on click", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({ id: "node-a", ref: "RISK-A", name: "Warehouse Fire" }),
            makeRisk({ id: "node-b", ref: "RISK-B", name: "Vendor Breach" }),
          ],
        },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      const searchInput = screen.getByRole("combobox", {
        name: "organization.riskGraph.searchLabel",
      })
      await userEvent.type(searchInput, "Warehouse")

      // "RISK-A" also matches the graph node's own aria-label ("Risk
      // RISK-A"), so scope to the search dropdown's listbox specifically.
      const dropdown = screen.getByRole("listbox")
      const match = within(dropdown).getByRole("option", { name: /RISK-A/ })
      expect(match).toBeInTheDocument()
      expect(
        within(dropdown).queryByRole("option", { name: /RISK-B/ })
      ).not.toBeInTheDocument()

      await userEvent.click(match)

      // Selecting via search reuses the same selectedRisk state the graph
      // node click path does -- the side panel heading confirms the right
      // risk got selected, and the search field clears itself.
      expect(
        screen.getByRole("heading", { name: "RISK-A — Warehouse Fire" })
      ).toBeInTheDocument()
      expect(searchInput).toHaveValue("")
    })

    it("shows no dropdown when the query matches nothing", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      const searchInput = screen.getByRole("combobox", {
        name: "organization.riskGraph.searchLabel",
      })
      await userEvent.type(searchInput, "nonexistent-query")

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      expect(searchInput).toHaveAttribute("aria-expanded", "false")
    })
  })

  // aexa-frontend#575 review: the legend documented edge colors and the
  // tipping-point icon but never explained that node size encodes PageRank.
  it("includes a legend entry explaining that node size encodes PageRank", () => {
    render(<RiskGraphPage />, withRouter)
    expect(
      screen.getByText("organization.riskGraph.legendNodeSize")
    ).toBeInTheDocument()
  })

  // aexa-frontend#575 review: a site-filtered-to-zero-risks state rendered a
  // blank canvas with no explanation.
  it("shows an empty-state message when no risks match the current filters", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)
    expect(
      screen.getByText("organization.riskGraph.emptyState")
    ).toBeInTheDocument()
  })

  // aexa-frontend#575 review: CAUSES/AMPLIFIES direction was only visible
  // once a cascade was selected -- the unselected graph couldn't
  // communicate direction at all.
  it("marks default (unselected) CAUSES/AMPLIFIES edges with a directional arrow, and leaves CORRELATES arrowless", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-b", ref: "RISK-B" }),
          makeRisk({ id: "node-c", ref: "RISK-C" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            { source_ref: "RISK-A", target_ref: "RISK-B", link_type: "CAUSES" },
            {
              source_ref: "RISK-B",
              target_ref: "RISK-C",
              link_type: "CORRELATES",
            },
          ],
        },
      },
      isLoading: false,
    })
    const { container } = render(<RiskGraphPage />, withRouter)

    // data-link-type targets each link's line unambiguously by its actual
    // link_type instead of inferring it from marker-end/stroke-opacity,
    // which only happened to disambiguate correctly for this exact fixture
    // shape (aexa-frontend#577 review).
    const causesLine = container.querySelector('line[data-link-type="CAUSES"]')
    const correlatesLine = container.querySelector(
      'line[data-link-type="CORRELATES"]'
    )
    expect(causesLine).not.toBeNull()
    expect(causesLine).toHaveAttribute("marker-end", "url(#arrowCauses)")
    expect(correlatesLine).not.toBeNull()
    expect(correlatesLine).not.toHaveAttribute("marker-end")
  })

  // aexa-frontend#577: the default (unselected) CAUSES/AMPLIFIES
  // arrowheads used to render at fillOpacity 0.35 -- identical to the
  // line's own default strokeOpacity -- so the arrowhead visually blended
  // into the line it was attached to, leaving direction unreadable (user
  // report). The arrowhead must render solid regardless of how translucent
  // the connecting line itself is drawn.
  it("renders default (unselected) CAUSES/AMPLIFIES arrowheads solid, not translucent like the line they're on", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-b", ref: "RISK-B" }),
          makeRisk({ id: "node-c", ref: "RISK-C" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            { source_ref: "RISK-A", target_ref: "RISK-B", link_type: "CAUSES" },
            {
              source_ref: "RISK-B",
              target_ref: "RISK-C",
              link_type: "AMPLIFIES",
            },
          ],
        },
      },
      isLoading: false,
    })
    const { container } = render(<RiskGraphPage />, withRouter)

    const causesArrowPolygon = container.querySelector(
      "marker#arrowCauses polygon"
    )
    const amplifiesArrowPolygon = container.querySelector(
      "marker#arrowAmplifies polygon"
    )
    expect(causesArrowPolygon).not.toHaveAttribute("fill-opacity")
    expect(amplifiesArrowPolygon).not.toHaveAttribute("fill-opacity")
  })

  // aexa-frontend#577 round-9.5 review: a shared <marker> can't itself
  // react to one particular line's isDimmed -- making the default
  // arrowhead solid (above) without a dimmed variant meant selecting a
  // risk turned every unrelated, nearly-invisible (strokeOpacity 0.08)
  // edge into a fully solid, brightly colored triangle with no visible
  // line connecting it to its nodes ("confetti"). A dimmed edge's
  // arrowhead must switch to a dimmed marker matching the line's own
  // opacity.
  it("switches an unrelated edge's arrowhead to a dimmed variant once a risk is selected, instead of leaving it solid", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "node-a", ref: "RISK-A" }),
          makeRisk({ id: "node-b", ref: "RISK-B" }),
          makeRisk({ id: "node-c", ref: "RISK-C" }),
        ],
      },
      isLoading: false,
    })
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: {
        data: {
          riskLinks: [
            { source_ref: "RISK-A", target_ref: "RISK-B", link_type: "CAUSES" },
          ],
        },
      },
      isLoading: false,
    })
    const { container } = render(<RiskGraphPage />, withRouter)

    // Before selection, the A->B edge isn't dimmed -- solid marker.
    const causesLine = container.querySelector('line[data-link-type="CAUSES"]')
    expect(causesLine).toHaveAttribute("marker-end", "url(#arrowCauses)")

    // Selecting an unrelated risk (C, with no links of its own) dims
    // A->B: it's not part of C's cascade (empty) and its source isn't C.
    await userEvent.click(screen.getByRole("button", { name: "Risk RISK-C" }))

    expect(causesLine).toHaveAttribute(
      "marker-end",
      "url(#arrowCausesDimmed)"
    )
    const dimmedPolygon = container.querySelector(
      "marker#arrowCausesDimmed polygon"
    )
    expect(dimmedPolygon).toHaveAttribute("fill-opacity", "0.08")
  })

  // aexa-frontend#577: the single most-cited gap against every reference
  // graph-viz tool -- the graph only ever shrunk-to-fit as more risks were
  // added, with no way to zoom in on a dense cluster or pan around.
  describe("zoom and pan (#577 round 2)", () => {
    function getTransformGroup(container: HTMLElement) {
      const group = container.querySelector("svg > g[transform]")
      expect(group).not.toBeNull()
      return group as SVGGElement
    }

    it("zooms in and out via the on-screen controls, and resets via the reset button", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const initialTransform =
        getTransformGroup(container).getAttribute("transform")
      expect(initialTransform).toBe("translate(0 0) scale(1)")

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskGraph.zoomIn",
        })
      )
      const zoomedInTransform =
        getTransformGroup(container).getAttribute("transform")
      expect(zoomedInTransform).not.toBe(initialTransform)
      expect(zoomedInTransform).toMatch(/scale\(1\.2\)/)

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskGraph.resetZoom",
        })
      )
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(0 0) scale(1)"
      )

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskGraph.zoomOut",
        })
      )
      const zoomedOutTransform =
        getTransformGroup(container).getAttribute("transform")
      expect(zoomedOutTransform).not.toBe(initialTransform)
      // 1 * (1/1.2) -- zoomOut uses the reciprocal factor of zoomIn's.
      expect(zoomedOutTransform).toMatch(/scale\(0\.8\d*\)/)
    })

    it("clamps zoom-in at the maximum scale instead of growing unbounded", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const zoomInButton = screen.getByRole("button", {
        name: "organization.riskGraph.zoomIn",
      })
      // 1 * 1.2^N grows past the documented MAX_ZOOM of 3 well before 20
      // clicks -- confirms clamping, not just "a big number". Each click
      // also re-centers x/y around the viewBox center (see zoomBy), so
      // only the scale factor itself is asserted here, not the exact
      // translate -- once clamped, repeated clicks stop changing scale
      // (nextScale === v.scale) but the x/y anchor math still runs every
      // time, which is fine (it's a no-op once already centered).
      for (let i = 0; i < 20; i++) {
        await userEvent.click(zoomInButton)
      }
      expect(getTransformGroup(container).getAttribute("transform")).toMatch(
        /scale\(3\)$/
      )
    })

    it("pans the view by dragging the background surface", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      // Not container.querySelector("svg > rect") -- lucide-react icons
      // (round 9's export menu adds one, Image, whose icon literally is a
      // rect) can also match "svg > rect", so the aria-label is the only
      // selector that unambiguously identifies the graph's own <svg>.
      const svg = screen.getByLabelText(
        "organization.riskGraph.graphKeyboardLabel"
      )
      const background = svg.querySelector("rect")!
      // jsdom's getBoundingClientRect returns all zeros -- the component
      // falls back to a 1:1 units-per-pixel ratio in that case, so a
      // 40px drag should translate to a 40-unit pan.
      fireEvent.mouseDown(background, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(svg, { clientX: 140, clientY: 130 })
      fireEvent.mouseUp(svg)

      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(40 30) scale(1)"
      )
    })

    it("does not pan when dragging starts on a graph node (so node clicks aren't hijacked)", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const node = screen.getByRole("button", { name: /^Risk / })
      const svg = node.closest("svg")!
      fireEvent.mouseDown(node, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(svg, { clientX: 140, clientY: 130 })
      fireEvent.mouseUp(svg)

      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(0 0) scale(1)"
      )
    })

    // aexa-frontend#577 round-3 review: the svg's touch-none class blocked
    // the browser's native touch scroll/pinch-zoom with no replacement --
    // touch/tablet users had *worse* graph interaction after round 2's
    // mouse-only pan/zoom than before it existed at all.
    it("pans the view with a single-finger touch drag", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const svg = screen.getByLabelText(
        "organization.riskGraph.graphKeyboardLabel"
      )
      const background = svg.querySelector("rect")!
      fireEvent.touchStart(background, {
        touches: [{ clientX: 100, clientY: 100 }],
      })
      fireEvent.touchMove(svg, {
        touches: [{ clientX: 140, clientY: 130 }],
      })
      fireEvent.touchEnd(svg, { touches: [] })

      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(40 30) scale(1)"
      )
    })

    it("zooms with a two-finger pinch, anchored the same way as scroll/button zoom", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const svg = screen.getByLabelText(
        "organization.riskGraph.graphKeyboardLabel"
      )
      // Fingers start 100px apart, end 200px apart -- a 2x pinch-out should
      // double the scale (clamped at MAX_ZOOM=3, so 1 -> 2 stays under it).
      fireEvent.touchStart(svg, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ],
      })
      fireEvent.touchMove(svg, {
        touches: [
          { clientX: 50, clientY: 100 },
          { clientX: 250, clientY: 100 },
        ],
      })
      fireEvent.touchEnd(svg, { touches: [] })

      expect(getTransformGroup(container).getAttribute("transform")).toMatch(
        /scale\(2\)$/
      )
    })

    it("a second finger landing mid-pan switches to pinch instead of continuing to pan", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const svg = screen.getByLabelText(
        "organization.riskGraph.graphKeyboardLabel"
      )
      const background = svg.querySelector("rect")!
      fireEvent.touchStart(background, {
        touches: [{ clientX: 100, clientY: 100 }],
      })
      // Second finger lands -- this must supersede the pan, not blend with
      // it (handleTouchStartPinch nulls panState.current).
      fireEvent.touchStart(svg, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ],
      })
      fireEvent.touchMove(svg, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ],
      })
      fireEvent.touchEnd(svg, { touches: [] })

      // No pinch distance change (100 -> 100), so scale stays 1 and no
      // leftover pan translation from the superseded single-finger drag.
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(0 0) scale(1)"
      )
    })

    it("resets the view when the site filter changes, but not on unrelated re-renders", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001", site_id: "site-1" })] },
        isLoading: false,
      })
      const { container, rerender } = render(<RiskGraphPage />, withRouter)

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskGraph.zoomIn",
        })
      )
      const zoomedTransform =
        getTransformGroup(container).getAttribute("transform")
      expect(zoomedTransform).not.toBe("translate(0 0) scale(1)")

      // An unrelated re-render (e.g. new risk data arriving for the same
      // site) must NOT reset the zoomed view -- only an actual site filter
      // change should.
      rerender(<RiskGraphPage />)
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        zoomedTransform
      )

      // Simulate selecting a different site via the real SiteFilter's
      // onChange, captured by the mock above -- this exercises
      // handleSiteFilterChange, the actual reset path (not a useEffect
      // keyed on siteFilter, per the #577 round-2 fix for React Compiler's
      // set-state-in-effect rule).
      capturedSiteFilterOnChange?.("site-2")
      rerender(<RiskGraphPage />)
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(0 0) scale(1)"
      )
    })

    // aexa-frontend#577 round 8: the +/- zoom buttons were real, tabbable
    // buttons, but there was no keyboard equivalent for panning at all --
    // a keyboard-only user could zoom in and then had no way to see
    // anything outside the initial viewport.
    it("pans via arrow keys, zooms via +/-, and resets via 0", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)
      // Not container.querySelector("svg") -- lucide-react icons (Search,
      // ZoomIn, the sidebar toggle, etc.) also render as raw <svg> tags, so
      // an unqualified selector can grab an unrelated icon instead of the
      // graph canvas. The aria-label uniquely identifies the real one.
      const svg = screen.getByLabelText(
        "organization.riskGraph.graphKeyboardLabel"
      )

      fireEvent.keyDown(svg, { key: "ArrowRight" })
      // Right pans the viewport right (reveals content further right), the
      // opposite sign from dragging -- same convention as a map, not a
      // hand-drag.
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(-40 0) scale(1)"
      )

      fireEvent.keyDown(svg, { key: "ArrowDown" })
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(-40 -40) scale(1)"
      )

      fireEvent.keyDown(svg, { key: "ArrowLeft" })
      fireEvent.keyDown(svg, { key: "ArrowUp" })
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(0 0) scale(1)"
      )

      fireEvent.keyDown(svg, { key: "+" })
      expect(getTransformGroup(container).getAttribute("transform")).toMatch(
        /scale\(1\.2\)/
      )

      fireEvent.keyDown(svg, { key: "0" })
      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(0 0) scale(1)"
      )

      fireEvent.keyDown(svg, { key: "-" })
      expect(getTransformGroup(container).getAttribute("transform")).toMatch(
        /scale\(0\.8\d*\)/
      )
    })

    // The handler is on the graph panel div, not just the <svg>, precisely
    // so a keyboard user who tabbed onto a node (not the canvas itself)
    // can still pan around it.
    it("pans via arrow keys even when a graph node, not the canvas, has focus", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const node = screen.getByRole("button", { name: "Risk RSK-001" })
      fireEvent.keyDown(node, { key: "ArrowRight" })

      expect(getTransformGroup(container).getAttribute("transform")).toBe(
        "translate(-40 0) scale(1)"
      )
    })

    it("gives the graph canvas a tabIndex and an aria-label describing the keyboard controls", () => {
      render(<RiskGraphPage />, withRouter)
      // tabIndex is a DOM property, not a plain HTML attribute (the actual
      // attribute is lowercase "tabindex") -- toHaveAttribute("tabIndex")
      // would silently never match.
      expect(
        (
          screen.getByLabelText(
            "organization.riskGraph.graphKeyboardLabel"
          ) as HTMLElement & { tabIndex: number }
        ).tabIndex
      ).toBe(0)
    })
  })

  // aexa-frontend#577 round 14: arrow-key pan and +/-/0 zoom (round 8) were
  // only ever announced via the <svg>'s aria-label -- invisible to a sighted
  // mouse-first user who'd never think to check accessibility metadata.
  describe("keyboard-shortcut affordance (#577 round 14)", () => {
    it("shows a visible keyboard-shortcut hint button near the zoom controls, with the same info the graph's own aria-label states", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      const hintButton = screen.getByRole("button", {
        name: "organization.riskGraph.keyboardHintAriaLabel",
      })
      expect(hintButton).toHaveAttribute(
        "title",
        "organization.riskGraph.keyboardHintTooltip"
      )

      // Distinct from the <svg>'s own aria-label -- both must stay
      // individually addressable, not collapse into one ambiguous match.
      expect(
        screen.getByLabelText("organization.riskGraph.graphKeyboardLabel")
      ).not.toBe(hintButton)
    })
  })

  // aexa-frontend#577 round 9: every reference graph-viz tool in the
  // original research (Cytoscape, Gephi, Neo4j Bloom) supports exporting
  // the current view as an image and the underlying data as a table --
  // this graph had neither.
  describe("export (#577 round 9)", () => {
    // jsdom doesn't implement URL.createObjectURL, and clicking a real <a
    // href> triggers jsdom's "not implemented: navigation" -- stub both so
    // the download flow runs without either.
    function stubDownload() {
      const createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:mock-url")
      const revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {})
      let downloadedFilename = ""
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
          downloadedFilename = this.download
        })
      return {
        createObjectURLSpy,
        getDownloadedFilename: () => downloadedFilename,
        restore: () => {
          createObjectURLSpy.mockRestore()
          revokeObjectURLSpy.mockRestore()
          clickSpy.mockRestore()
        },
      }
    }

    it("exports the graph as a standalone SVG file", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)
      const download = stubDownload()

      await userEvent.click(
        screen.getByText("organization.riskGraph.exportSvg")
      )

      expect(download.getDownloadedFilename()).toBe("risk-graph.svg")
      const blob = download.createObjectURLSpy.mock.calls[0][0] as Blob
      expect(blob.type).toBe("image/svg+xml;charset=utf-8")
      // Standalone (parseable outside the app, with its own explicit
      // width/height -- the live <svg> only has a viewBox and relies on its
      // CSS class for on-screen sizing) and includes the actual node data,
      // not an empty shell.
      const text = await blob.text()
      expect(text).toContain('<?xml version="1.0"')
      expect(text).toContain('width="')
      expect(text).toContain("RSK-001")

      download.restore()
    })

    it("exports the graph's underlying data as CSV, scoped to the current filters", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              ref: "RSK-001",
              name: "Supply, Chain Disruption",
              category: "supply_chain",
              financial_impact_min: 50000,
              financial_impact_max: 200000,
              probability: 60,
            }),
          ],
        },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)
      const download = stubDownload()

      await userEvent.click(
        screen.getByText("organization.riskGraph.exportCsv")
      )

      expect(download.getDownloadedFilename()).toBe("risk-graph-data.csv")
      const blob = download.createObjectURLSpy.mock.calls[0][0] as Blob
      expect(blob.type).toBe("text/csv;charset=utf-8;")
      const text = await blob.text()
      const [header, row] = text.split("\r\n")
      expect(header).toBe(
        "Ref,Name,Category,Financial Impact Min (k€),Financial Impact Max (k€),Probability (%),PageRank"
      )
      // The risk's own name contains a comma -- must be quoted, not split
      // into extra fields.
      expect(row).toBe(
        'RSK-001,"Supply, Chain Disruption",supply_chain,50000,200000,60,100'
      )

      download.restore()
    })

    it("kicks off a PNG export via an SVG-to-canvas round trip without throwing", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)
      const createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:mock-url")
      const revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {})

      // jsdom doesn't actually decode images, so the onload -> canvas ->
      // toBlob -> download tail of exportGraphAsPng never runs here -- this
      // only exercises (and guards against a regression in) the part that
      // does run synchronously: building the export SVG and handing it to
      // the browser's image-loading pipeline.
      await userEvent.click(
        screen.getByText("organization.riskGraph.exportPng")
      )

      expect(createObjectURLSpy).toHaveBeenCalled()
      const blob = createObjectURLSpy.mock.calls[0][0] as Blob
      expect(blob.type).toBe("image/svg+xml;charset=utf-8")

      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })

    // aexa-frontend#577 round-9 review: only image.onload was wired -- a
    // decode failure left the object URL leaked (never revoked) and the
    // user with zero feedback that the export silently did nothing.
    it("revokes the object URL and shows an error toast if the PNG image fails to decode", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ ref: "RSK-001" })] },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)
      const createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:mock-url")
      const revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {})
      // jsdom never fires a real Image's onload/onerror -- stub the global
      // so setting .src synchronously simulates a decode failure.
      const OriginalImage = globalThis.Image
      class FailingImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) {
          this.onerror?.()
        }
      }
      // @ts-expect-error -- deliberately narrower than the real Image type
      globalThis.Image = FailingImage

      await userEvent.click(
        screen.getByText("organization.riskGraph.exportPng")
      )

      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url")
      expect(toast.error).toHaveBeenCalledWith(
        "organization.riskGraph.exportPngFailed"
      )

      globalThis.Image = OriginalImage
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
    })

    // aexa-frontend#577 round-9 review: risk.name/category are free text
    // from the Risk Register -- a cell starting with =/+/-/@ executes as a
    // formula when the CSV is opened in Excel/LibreOffice ("CSV
    // injection"), e.g. a risk literally named =HYPERLINK(...).
    it("prefixes a CSV field starting with =, +, -, or @ with an apostrophe to prevent formula injection", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              ref: "RSK-001",
              name: '=HYPERLINK("http://evil.example","click me")',
              category: "cyber",
              probability: 60,
            }),
          ],
        },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)
      const download = stubDownload()

      await userEvent.click(
        screen.getByText("organization.riskGraph.exportCsv")
      )

      const blob = download.createObjectURLSpy.mock.calls[0][0] as Blob
      const text = await blob.text()
      const [, row] = text.split("\r\n")
      expect(row).toBe(
        'RSK-001,"\'=HYPERLINK(""http://evil.example"",""click me"")",cyber,50000,200000,60,100'
      )

      download.restore()
    })

    // aexa-frontend#577 round-9 review, round 2: the formula-injection
    // guard above was applied to every column, including the numeric
    // financial-impact ones -- a leading "-" also matches the same
    // =/+/-/@ regex, and the risk form has no min="0" constraint on those
    // fields, so a legitimately negative value got force-text-prefixed
    // too, silently corrupting the exported column's numeric type even
    // though the value was never attacker-controlled free text.
    it("does not apostrophe-prefix a legitimately negative financial impact value", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              ref: "RSK-001",
              financial_impact_min: -500,
              financial_impact_max: -100,
              probability: 60,
            }),
          ],
        },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)
      const download = stubDownload()

      await userEvent.click(
        screen.getByText("organization.riskGraph.exportCsv")
      )

      const blob = download.createObjectURLSpy.mock.calls[0][0] as Blob
      const text = await blob.text()
      const [, row] = text.split("\r\n")
      expect(row).toBe(
        "RSK-001,Supply Chain Disruption,supply_chain,-500,-100,60,100"
      )

      download.restore()
    })
  })

  // aexa-frontend#577 round 10: a small graph already fits the viewport at
  // scale 1 -- once there's more graph than the viewport can show at once
  // (many risks, likely zoomed/panned around), there was no overview of
  // where the current viewport sits relative to the whole graph.
  describe("minimap (#577 round 10)", () => {
    function manyRisks(count: number) {
      return Array.from({ length: count }, (_, i) =>
        makeRisk({ id: `node-${i}`, ref: `RISK-${i}` })
      )
    }

    function getMainGraphViewBoxSize() {
      const mainSvg = screen.getByLabelText(
        "organization.riskGraph.graphKeyboardLabel"
      )
      const [, , width, height] = (mainSvg.getAttribute("viewBox") ?? "")
        .split(" ")
        .map(Number)
      return { width, height }
    }

    it("does not render a minimap for a graph small enough to already fit the viewport", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: manyRisks(9) },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      expect(
        screen.queryByLabelText("organization.riskGraph.minimapLabel")
      ).not.toBeInTheDocument()
    })

    it("renders a minimap with one dot per risk and a viewport rectangle once there are enough risks", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: manyRisks(10) },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      const minimap = screen.getByLabelText(
        "organization.riskGraph.minimapLabel"
      )
      expect(minimap.querySelectorAll("circle")).toHaveLength(10)

      // The viewport rectangle (the last <rect>, after the transparent
      // background one) must match the main graph's own viewBox exactly
      // at the default (unzoomed, unpanned) view -- the whole graph is
      // the visible viewport.
      const { width, height } = getMainGraphViewBoxSize()
      const rects = minimap.querySelectorAll("rect")
      const viewportRect = rects[rects.length - 1]
      // -view.x/view.scale at the default view.x=0 is JS's negative zero,
      // which stringifies to "0" (String(-0) === "0"), not "-0".
      expect(viewportRect).toHaveAttribute("x", "0")
      expect(viewportRect).toHaveAttribute("y", "0")
      expect(viewportRect).toHaveAttribute("width", String(width))
      expect(viewportRect).toHaveAttribute("height", String(height))
    })

    it("recenters the main view on the clicked minimap point", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: manyRisks(10) },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      const minimap = screen.getByLabelText(
        "organization.riskGraph.minimapLabel"
      ) as unknown as SVGSVGElement
      // jsdom's getBoundingClientRect returns all zeros by default, which
      // handleMinimapClick treats as "not yet laid out" and ignores --
      // mock a real rendered size so the click math actually runs.
      vi.spyOn(minimap, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 140,
        height: 100,
        right: 140,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      })

      // Clicking the minimap's top-left corner (content coordinate 0,0)
      // should recenter the main view so that point becomes the new
      // viewport center: x = graphWidth/2, y = graphHeight/2, at the
      // unchanged (default) scale.
      fireEvent.click(minimap, { clientX: 0, clientY: 0 })

      const { width, height } = getMainGraphViewBoxSize()
      const group = container.querySelector("svg > g[transform]")!
      expect(group.getAttribute("transform")).toBe(
        `translate(${width / 2} ${height / 2}) scale(1)`
      )
    })

    // aexa-frontend#577 round-10 review: click-to-jump is inherently a
    // pointer gesture with no literal keyboard equivalent, but the minimap
    // still needs to be a reachable, operable control -- not a role="img"
    // graphic a keyboard-only user can't act on at all (the graph itself
    // is already fully keyboard-operable via round 8's arrow-key pan and
    // +/-/0 zoom).
    it("is keyboard-focusable and resets the view on Enter", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: manyRisks(10) },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      // Zoom in first so there's an actual view to reset -- otherwise
      // Enter resetting to the already-default view wouldn't distinguish
      // "it did something" from "it did nothing".
      await userEvent.click(
        screen.getByRole("button", { name: "organization.riskGraph.zoomIn" })
      )
      const zoomedTransform = container
        .querySelector("svg > g[transform]")!
        .getAttribute("transform")
      expect(zoomedTransform).not.toBe("translate(0 0) scale(1)")

      const minimap = screen.getByLabelText(
        "organization.riskGraph.minimapLabel"
      )
      expect(minimap.tagName.toLowerCase()).toBe("svg")
      expect((minimap as unknown as HTMLElement).tabIndex).toBe(0)

      fireEvent.keyDown(minimap, { key: "Enter" })

      expect(
        container.querySelector("svg > g[transform]")!.getAttribute("transform")
      ).toBe("translate(0 0) scale(1)")
    })
  })

  // aexa-frontend#577 round 4: RISK_CATEGORIES already drove node color and
  // the category-clustered layout, but there was no way to isolate or hide
  // a category -- only the site filter existed.
  describe("category filter (#577 round 4)", () => {
    it("shows no category chips when every risk shares one category", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({ id: "node-a", ref: "RISK-A", category: "cyber" }),
            makeRisk({ id: "node-b", ref: "RISK-B", category: "cyber" }),
          ],
        },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      expect(
        screen.queryByRole("button", { name: /organization\.riskCategories/ })
      ).not.toBeInTheDocument()
    })

    it("hides a category's nodes when its chip is toggled off, and shows it again on re-toggle", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({ id: "node-a", ref: "RISK-A", category: "cyber" }),
            makeRisk({ id: "node-b", ref: "RISK-B", category: "financial" }),
          ],
        },
        isLoading: false,
      })
      render(<RiskGraphPage />, withRouter)

      const chips = screen.getAllByRole("button", {
        name: /organization\.riskCategories/,
      })
      expect(chips).toHaveLength(2)
      chips.forEach((chip) =>
        expect(chip).toHaveAttribute("aria-pressed", "true")
      )

      // Both nodes present before any toggle.
      expect(
        screen.getByRole("button", { name: /^Risk RISK-A/ })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /^Risk RISK-B/ })
      ).toBeInTheDocument()

      const cyberChip = chips.find((c) => c.textContent?.includes("catCyber"))!
      await userEvent.click(cyberChip)

      expect(cyberChip).toHaveAttribute("aria-pressed", "false")
      expect(
        screen.queryByRole("button", { name: /^Risk RISK-A/ })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /^Risk RISK-B/ })
      ).toBeInTheDocument()

      await userEvent.click(cyberChip)
      expect(cyberChip).toHaveAttribute("aria-pressed", "true")
      expect(
        screen.getByRole("button", { name: /^Risk RISK-A/ })
      ).toBeInTheDocument()
    })

    it("resets the view when a category is toggled, same as a site filter change", async () => {
      const { default: userEvent } = await import("@testing-library/user-event")
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({ id: "node-a", ref: "RISK-A", category: "cyber" }),
            makeRisk({ id: "node-b", ref: "RISK-B", category: "financial" }),
          ],
        },
        isLoading: false,
      })
      const { container } = render(<RiskGraphPage />, withRouter)

      await userEvent.click(
        screen.getByRole("button", { name: "organization.riskGraph.zoomIn" })
      )
      const svgGroup = container.querySelector("svg > g[transform]")!
      expect(svgGroup.getAttribute("transform")).not.toBe(
        "translate(0 0) scale(1)"
      )

      const cyberChip = screen
        .getAllByRole("button", { name: /organization\.riskCategories/ })
        .find((c) => c.textContent?.includes("catCyber"))!
      await userEvent.click(cyberChip)

      expect(
        container.querySelector("svg > g[transform]")!.getAttribute("transform")
      ).toBe("translate(0 0) scale(1)")
    })
  })
})
