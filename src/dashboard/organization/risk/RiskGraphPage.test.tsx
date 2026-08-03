import { render, screen, within } from "@testing-library/react"
import RiskGraphPage from "./RiskGraphPage"

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetCorrelationMatrixDataQuery = vi.fn()

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
    render(<RiskGraphPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows a loading state while the correlation graph (used for the real tipping-point PageRank) is loading", () => {
    mockUseGetCorrelationMatrixDataQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<RiskGraphPage />)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders real risk ids as graph nodes, not the old mock fixture ids", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ id: "risk-real-1" })] },
      isLoading: false,
    })
    render(<RiskGraphPage />)

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
    render(<RiskGraphPage />)

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
    render(<RiskGraphPage />)

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

  it("shows zero correlations rather than fabricated links against real risk data", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({ id: "risk-real-1" }),
          makeRisk({ id: "risk-real-2" }),
        ],
      },
      isLoading: false,
    })
    render(<RiskGraphPage />)

    // t() echoes the key in the test env (i18n is not initialized in setup).
    expect(
      screen.getByText("organization.riskGraph.correlations (0)")
    ).toBeInTheDocument()
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
    render(<RiskGraphPage />)

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
    render(<RiskGraphPage />)

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
    render(<RiskGraphPage />)

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
})
