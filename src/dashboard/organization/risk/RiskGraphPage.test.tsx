import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import RiskGraphPage from "./RiskGraphPage"

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
      (_, el) => el?.tagName.toLowerCase() === "title" && el.textContent === `${longRef} — Supply Chain Disruption`
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
    const headingMatches = screen.getAllByText("RISK-A — Supply Chain Disruption")
    expect(
      headingMatches.some((el) => el.closest("h3") !== null)
    ).toBe(true)
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

  // aexa-frontend#473 -- h1 used to be followed directly by h3s with no h2
  // in between, breaking heading-level order for screen readers.
  it("has an h2 between the page h1 and its h3 section headings", () => {
    render(<RiskGraphPage />, withRouter)

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(
      screen.getAllByRole("heading", { level: 2 }).length
    ).toBeGreaterThan(0)
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
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] }, isLoading: false })
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
            { source_ref: "RISK-B", target_ref: "RISK-C", link_type: "CORRELATES" },
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

      const initialTransform = getTransformGroup(container).getAttribute(
        "transform"
      )
      expect(initialTransform).toBe("translate(0 0) scale(1)")

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskGraph.zoomIn",
        })
      )
      const zoomedInTransform = getTransformGroup(container).getAttribute(
        "transform"
      )
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
      const zoomedOutTransform = getTransformGroup(container).getAttribute(
        "transform"
      )
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

      // container.querySelector("svg") would match whichever <svg> comes
      // first in the DOM -- often a lucide icon (e.g. the search input's
      // Search icon), not the graph -- so derive the graph's own <svg> from
      // its background rect instead.
      const background = container.querySelector("svg > rect")!
      const svg = background.closest("svg")!
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

      const background = container.querySelector("svg > rect")!
      const svg = background.closest("svg")!
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

      const background = container.querySelector("svg > rect")!
      const svg = background.closest("svg")!
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

      const background = container.querySelector("svg > rect")!
      const svg = background.closest("svg")!
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
  })
})
