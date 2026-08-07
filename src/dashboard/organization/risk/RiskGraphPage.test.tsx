import { render, screen, within } from "@testing-library/react"
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
// text, same pattern as RiskMatrixPage.test.tsx.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string) => {
        if (key === "organization.riskGraph.pagerankAbbrLabel") {
          return "PR:"
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
// Overview.test.tsx uses for CriticalAlertBanner.
vi.mock("@/components/dashboard/organization/SiteFilter", () => ({
  default: () => null,
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

  it("renders real risk ids as graph nodes, not the old mock fixture ids", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-real-1" })] },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // Short ids fit inside the node, so both the SVG <text> label and the
    // <title> tooltip render the id in full (two matching elements).
    const matches = screen.getAllByText("risk-real-1")
    expect(matches.some((el) => el.tagName.toLowerCase() === "text")).toBe(true)
    expect(screen.queryByText("risk_fire")).not.toBeInTheDocument()
  })

  it("truncates a full-length UUID node label but keeps the full id in a tooltip", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: uuid })] },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    // The visible node label is truncated to the first 8 chars of the UUID...
    const label = screen.getByText("123e4567")
    expect(label.tagName.toLowerCase()).toBe("text")
    // ...while the full UUID is preserved only in the <title> tooltip.
    const fullId = screen.getByText(uuid)
    expect(fullId.tagName.toLowerCase()).toBe("title")
  })

  it("aexa-frontend#376: shows selected risk's max impact as M€ from its stored k€ units", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ id: "risk-real-1", financial_impact_max: 500000 })],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const nodeLabel = screen
      .getAllByText("risk-real-1")
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
  // #548/#549 fixed on the risk-matrix pages.
  it("links the selected risk's side-panel heading to its detail page", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [makeRisk({ id: "risk-real-1", name: "Supply Chain Disruption" })],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />, withRouter)

    const nodeLabel = screen
      .getAllByText("risk-real-1")
      .find((el) => el.tagName.toLowerCase() === "text")!
    await userEvent.click(nodeLabel)

    const link = screen.getByRole("link", {
      name: "risk-real-1 — Supply Chain Disruption",
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

    // The graph node's visible label is shortRef(risk.id) ("uuid-a"), not
    // its ref -- clicking it exercises setSelectedRisk(risk.ref) internally.
    const nodeALabel = screen
      .getAllByText("uuid-a")
      .find((el) => el.tagName.toLowerCase() === "text")!
    await userEvent.click(nodeALabel)

    // Selecting RISK-A cascades into RISK-HUB via the CAUSES link -- only
    // reachable if the link's ref-space source/target actually resolved to
    // real node positions/selection state (cascadeRefs, positions,
    // selectedRiskData are all keyed by ref, per the fix above). The side
    // panel's header shows the selected risk's uuid id and name.
    expect(
      screen.getByText("uuid-a — Supply Chain Disruption")
    ).toBeInTheDocument()
    expect(screen.getAllByText(/uuid-hub/).length).toBeGreaterThan(0)
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
      .getAllByText("node-hub")
      .find((el) => el.tagName.toLowerCase() === "text")!
    const hubGroup = hubLabel.closest("g") as unknown as HTMLElement
    expect(
      within(hubGroup).getByTitle("organization.riskGraph.legendTippingPoint")
    ).toBeInTheDocument()

    const isolatedLabel = screen
      .getAllByText("node-a")
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
      .getAllByText("node-hub")
      .find((el) => el.tagName.toLowerCase() === "text")!
    const hubGroup = hubLabel.closest("g") as unknown as HTMLElement
    expect(within(hubGroup).getByText("PR:100")).toBeInTheDocument()
    expect(within(hubGroup).queryByText("PR:3")).not.toBeInTheDocument()

    // node-a has no inbound links, so its real PageRank is below the hub's
    // -- it must not render the fake pagerank_score of 999.
    const nodeALabel = screen
      .getAllByText("node-a")
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

    const node = screen.getByRole("button", {
      name: /organization\.riskGraph\.nodeAriaLabel/,
    })
    expect(node.tagName.toLowerCase()).toBe("g")
    expect(node).toHaveAttribute("tabindex", "0")
    expect(node).toHaveAttribute("aria-pressed", "false")

    node.focus()
    await userEvent.keyboard("{Enter}")
    expect(node).toHaveAttribute("aria-pressed", "true")

    await userEvent.keyboard(" ")
    expect(node).toHaveAttribute("aria-pressed", "false")
  })
})
