import type { IntelligenceItem, IntelligenceRun } from "@/types/organization"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import IntelligencePage from "./IntelligencePage"

// The page renders a react-router <Link> for "View Risk" -- needs a Router
// context, same convention as FindingDetails.test.tsx.
function renderPage() {
  return render(
    <MemoryRouter>
      <IntelligencePage />
    </MemoryRouter>
  )
}

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation -- fine for every other assertion here, which only checks
// for the literal key text. But that means a test asserting on
// sections.itemsCount can't actually distinguish `count: meta.total` from
// `count: items.length` by text alone (both render the same key). Only
// override that one key so the count value becomes visible in the
// rendered text; every other key still falls back to itself unchanged,
// so no existing assertion elsewhere in this file is affected.
// mockLanguage feeds `i18n.language` through to the real hook's `i18n`
// object below, so the round-3 audit fix (item.scraped_at now going through
// formatLocaleDate(item.scraped_at, i18n.language) instead of being
// hardcoded to "en-US") can be exercised by the locale test further down --
// same convention as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return {
        ...real,
        i18n: { ...real.i18n, language: mockLanguage },
        t: (key: string, opts?: Record<string, unknown>) =>
          key === "organization.intelligence.sections.itemsCount"
            ? `${key}:${opts?.count}`
            : key,
      }
    },
  }
})

// Role hook is mocked per-test via this mutable holder, same convention as
// RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

const mockUseGetIntelligenceItemsQuery = vi.fn()
const mockUseGetIntelligenceRunsQuery = vi.fn()
const mockScrape = vi.fn()
const mockAnalyze = vi.fn()
const mockPredict = vi.fn()
const mockGenerateMitigations = vi.fn()
const mockGenerateRcsa = vi.fn()
const mockResilienceScan = vi.fn()
const mockCreateRiskFromItem = vi.fn()

vi.mock("@/redux/apis/organization/intelligence.api", () => ({
  useGetIntelligenceItemsQuery: (...args: unknown[]) =>
    mockUseGetIntelligenceItemsQuery(...args),
  useGetIntelligenceRunsQuery: (...args: unknown[]) =>
    mockUseGetIntelligenceRunsQuery(...args),
  useScrapeIntelligenceMutation: () => [mockScrape, { isLoading: false }],
  useAnalyzeIntelligenceMutation: () => [mockAnalyze, { isLoading: false }],
  usePredictTrendsMutation: () => [mockPredict, { isLoading: false }],
  useGenerateMitigationsMutation: () => [
    mockGenerateMitigations,
    { isLoading: false },
  ],
  useGenerateRcsaMutation: () => [mockGenerateRcsa, { isLoading: false }],
  useResilienceScanMutation: () => [mockResilienceScan, { isLoading: false }],
  useCreateRiskFromItemMutation: () => [
    mockCreateRiskFromItem,
    { isLoading: false },
  ],
}))

function makeItem(overrides: Partial<IntelligenceItem> = {}): IntelligenceItem {
  return {
    id: "item-1",
    org_account_id: "org-1",
    title: "Ransomware campaign targets manufacturers",
    description: "A sophisticated ransomware group...",
    link: null,
    source_name: "Cyber Threat Intel",
    source_category: "cyber",
    source_credibility: 0.9,
    source_language: "en",
    published_at: "2026-04-15T10:30:00.000Z",
    scraped_at: "2026-04-15T10:30:00.000Z",
    is_risk: true,
    severity: "high",
    category: "cyber",
    relevance_score: 0.87,
    risk_summary: "High likelihood of supply chain impact.",
    root_cause: "Phishing",
    potential_impact: "Operational disruption",
    recommended_actions: null,
    confidence: 0.8,
    source_evidence: null,
    analyzed_at: "2026-04-15T11:00:00.000Z",
    created_risk_id: null,
    ...overrides,
  }
}

function makeRun(overrides: Partial<IntelligenceRun> = {}): IntelligenceRun {
  return {
    id: "run-1",
    org_account_id: "org-1",
    run_type: "PREDICT",
    result: {},
    createdAt: "2026-04-15T10:30:00.000Z",
    ...overrides,
  }
}

const emptyItemsResult = {
  data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPage: 1 } },
}
const emptyRunsResult = {
  data: { data: [], meta: { page: 1, limit: 1, total: 0, totalPage: 1 } },
}

describe("IntelligencePage", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockRole = "ADMIN"
    mockUseGetIntelligenceItemsQuery.mockReset()
    mockUseGetIntelligenceRunsQuery.mockReset()
    mockScrape.mockReset()
    mockAnalyze.mockReset()
    mockPredict.mockReset()
    mockGenerateMitigations.mockReset()
    mockGenerateRcsa.mockReset()
    mockResilienceScan.mockReset()
    mockCreateRiskFromItem.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()

    mockUseGetIntelligenceItemsQuery.mockReturnValue(emptyItemsResult)
    mockUseGetIntelligenceRunsQuery.mockReturnValue(emptyRunsResult)
  })

  it("renders intelligence items from the real query", () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.getByText("Ransomware campaign targets manufacturers")
    ).toBeInTheDocument()
    expect(screen.getByText("Cyber Threat Intel")).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (resilience, round-1 finding): isError was
  // never checked on any of the 5 queries on this page -- a genuine
  // fetch failure fell through to the default/empty states and rendered
  // a normal-looking "no items yet" UI, indistinguishable from a real
  // empty state.
  it("shows a distinct error state, not an empty list, when the items query fails", () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : { data: undefined, isError: true }
    )

    renderPage()

    expect(
      screen.getByText("organization.intelligence.sections.itemsLoadError")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.intelligence.sections.itemsEmpty")
    ).not.toBeInTheDocument()
  })

  // Review finding (round 2): a failed REFETCH after an already-successful
  // page must keep showing the still-valid stale list RTK Query retains,
  // not discard it in favor of the error state -- same guard shape as the
  // 4 report panels' xError && !xResult.
  it("keeps showing the stale item list, not the error state, when isError is true but real data is still present", () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
              isError: true,
            }
    )

    renderPage()

    expect(
      screen.getByText("Ransomware campaign targets manufacturers")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.intelligence.sections.itemsLoadError")
    ).not.toBeInTheDocument()
  })

  it("shows a distinct error notice, not a silently missing panel, when a report run query fails", () => {
    mockUseGetIntelligenceRunsQuery.mockImplementation(
      (args: { run_type: string }) =>
        args.run_type === "PREDICT"
          ? { data: undefined, isError: true }
          : emptyRunsResult
    )

    renderPage()

    expect(
      screen.getByText("organization.intelligence.sections.predictLoadError")
    ).toBeInTheDocument()
    // Only the failed report's notice shows -- the other 3 report types
    // (still an empty-but-successful fetch) don't also show an error.
    expect(
      screen.queryByText(
        "organization.intelligence.sections.mitigationsLoadError"
      )
    ).not.toBeInTheDocument()
  })

  // aexa-frontend round-3 audit bug #3: item.scraped_at was hardcoded to
  // "en-US" regardless of the active UI language.
  it("formats the scraped_at date in French when the UI language is French", () => {
    mockLanguage = "fr"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem({ scraped_at: "2026-04-15T10:30:00.000Z" })],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    const expected = new Date("2026-04-15T10:30:00.000Z").toLocaleDateString(
      "fr-FR"
    )
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("shows the empty state when there are no items", () => {
    renderPage()

    expect(
      screen.getByText("organization.intelligence.sections.itemsEmpty")
    ).toBeInTheDocument()
  })

  it("triggers the scrape mutation and shows a success toast", async () => {
    mockScrape.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: {
            items: [],
            sourcesTotal: 62,
            sourcesSucceeded: 58,
            itemsScraped: 12,
            itemsNew: 5,
          },
        }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.scrape",
      })
    )

    await waitFor(() => expect(mockScrape).toHaveBeenCalled())
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("triggers the analyze mutation and shows the result count", async () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? {
              data: {
                data: [],
                meta: { page: 1, limit: 1, total: 3, totalPage: 1 },
              },
            }
          : emptyItemsResult
    )
    mockAnalyze.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: { items: [], count: 3 },
        }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.analyzeCount",
      })
    )

    await waitFor(() => expect(mockAnalyze).toHaveBeenCalled())
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("triggers the predict mutation", async () => {
    mockPredict.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: makeRun(),
        }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.predict",
      })
    )

    await waitFor(() => expect(mockPredict).toHaveBeenCalled())
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("triggers the mitigations mutation", async () => {
    mockGenerateMitigations.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeRun() }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.mitigations",
      })
    )

    await waitFor(() => expect(mockGenerateMitigations).toHaveBeenCalled())
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("triggers the RCSA mutation", async () => {
    mockGenerateRcsa.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeRun() }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.rcsa",
      })
    )

    await waitFor(() => expect(mockGenerateRcsa).toHaveBeenCalled())
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("triggers the resilience scan mutation", async () => {
    mockResilienceScan.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "ok", data: makeRun() }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.resilienceScan",
      })
    )

    await waitFor(() => expect(mockResilienceScan).toHaveBeenCalled())
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows a toast when a mutation fails", async () => {
    mockScrape.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "AI service error: 502" } }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.actions.scrape",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("AI service error: 502")
    )
  })

  it("renders the Create Risk button for ADMIN on an analyzed, not-yet-promoted item", () => {
    mockRole = "ADMIN"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.getByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).toBeInTheDocument()
  })

  it("hides the Create Risk button for VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).not.toBeInTheDocument()
  })

  it("shows a View Risk link instead of Create Risk once created_risk_id is set", () => {
    mockRole = "ADMIN"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem({ created_risk_id: "risk-99" })],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.intelligence.item.viewRisk")
    ).toBeInTheDocument()
  })

  it("calls createRiskFromItem when Create Risk is clicked", async () => {
    mockRole = "ADMIN"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )
    mockCreateRiskFromItem.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: { id: "risk-99", name: "Ransomware campaign" },
        }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    )

    await waitFor(() =>
      expect(mockCreateRiskFromItem).toHaveBeenCalledWith({
        itemId: "item-1",
      })
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  // Round-1 review gap: only scrape's rejection path was tested. Every
  // mutation goes through the same errorMessage()-then-toast.error pattern,
  // but each is wired to its own catch block -- worth confirming each one
  // individually rather than assuming they all behave the same.
  const rejectionCases: Array<{
    name: string
    mock: typeof mockAnalyze
    buttonName: string
  }> = [
    {
      name: "analyze",
      mock: mockAnalyze,
      buttonName: "organization.intelligence.actions.analyzeCount",
    },
    {
      name: "predict",
      mock: mockPredict,
      buttonName: "organization.intelligence.actions.predict",
    },
    {
      name: "mitigations",
      mock: mockGenerateMitigations,
      buttonName: "organization.intelligence.actions.mitigations",
    },
    {
      name: "rcsa",
      mock: mockGenerateRcsa,
      buttonName: "organization.intelligence.actions.rcsa",
    },
    {
      name: "resilienceScan",
      mock: mockResilienceScan,
      buttonName: "organization.intelligence.actions.resilienceScan",
    },
  ]

  for (const { name, mock, buttonName } of rejectionCases) {
    it(`shows a toast with the real error message when ${name} fails`, async () => {
      // The Analyze button is disabled when there are 0 un-analyzed items
      // (the default empty-query mock from beforeEach), so give it a
      // non-zero count here -- same setup the passing "triggers the analyze
      // mutation" test above already uses.
      if (name === "analyze") {
        mockUseGetIntelligenceItemsQuery.mockImplementation(
          (args: { analyzed?: boolean }) =>
            args.analyzed === false
              ? {
                  data: {
                    data: [],
                    meta: { page: 1, limit: 1, total: 3, totalPage: 1 },
                  },
                }
              : emptyItemsResult
        )
      }
      mock.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: `${name} backend error` } }),
      })

      renderPage()
      await userEvent.click(screen.getByRole("button", { name: buttonName }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(`${name} backend error`)
      )
    })
  }

  it("shows a toast with the real error message when createRiskFromItem fails", async () => {
    mockRole = "ADMIN"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )
    mockCreateRiskFromItem.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "create-risk backend error" } }),
    })

    renderPage()
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("create-risk backend error")
    )
  })

  // Round-1 review gap: only ADMIN-visible and VIEWER-hidden were tested,
  // despite the actual gate being `role === "ADMIN" || role === "LEAD_AUDITOR"`
  // -- LEAD_AUDITOR (should show) and LIGHT_USER (should hide) had zero
  // coverage, and the old test's name falsely implied LIGHT_USER was covered.
  it("shows the Create Risk button for LEAD_AUDITOR", () => {
    mockRole = "LEAD_AUDITOR"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.getByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).toBeInTheDocument()
  })

  it("hides the Create Risk button for LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).not.toBeInTheDocument()
  })

  // Round-1 review gap: the existing "calls createRiskFromItem" test only
  // asserted the mutation fired -- it never verified the UI actually
  // transitions afterward. In the real app that transition comes from RTK
  // Query's cache invalidation causing useGetIntelligenceItemsQuery to
  // refetch with created_risk_id now set; since this file mocks the hook
  // directly (no real store), we simulate that refetch by having the mock's
  // return value change after the mutation resolves, then re-rendering --
  // the same externally-observable effect a real invalidated-tag refetch
  // would produce.
  it("shows View Risk instead of Create Risk after createRiskFromItem succeeds", async () => {
    mockRole = "ADMIN"
    let itemsAnalyzedResult = {
      data: {
        data: [makeItem()],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
    }
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false ? emptyItemsResult : itemsAnalyzedResult
    )
    mockCreateRiskFromItem.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "ok",
          data: { id: "risk-99", name: "Ransomware campaign" },
        }),
    })

    const { rerender } = renderPage()
    expect(
      screen.getByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    )
    await waitFor(() => expect(mockCreateRiskFromItem).toHaveBeenCalled())

    // Simulate the refetch a real invalidated INTELLIGENCE_ITEM tag would
    // trigger: the item now comes back with created_risk_id set.
    itemsAnalyzedResult = {
      data: {
        data: [makeItem({ created_risk_id: "risk-99" })],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
    }
    rerender(
      <MemoryRouter>
        <IntelligencePage />
      </MemoryRouter>
    )

    expect(
      screen.queryByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.intelligence.item.viewRisk")
    ).toBeInTheDocument()
  })

  // Round-1 review gap: the runtime type guards (intelligenceRunTypes.ts)
  // had zero test coverage in either direction -- no test proved they accept
  // real well-formed aexa-ai response shapes, and no test proved they reject
  // a malformed/partial one instead of letting the component crash on a
  // missing field.
  describe("runtime type guards for IntelligenceRun.result", () => {
    function mockRunsFor(runType: string, result: unknown) {
      mockUseGetIntelligenceRunsQuery.mockImplementation(
        (args: { run_type: string }) =>
          args.run_type === runType
            ? {
                data: {
                  data: [makeRun({ run_type: runType as never, result })],
                  meta: { page: 1, limit: 1, total: 1, totalPage: 1 },
                },
              }
            : emptyRunsResult
      )
    }

    it("renders the predict panel for a well-formed result and rejects a malformed one", () => {
      mockRunsFor("PREDICT", {
        score_7d: 42,
        score_30d: 55,
        trend: "worsening",
        confidence: 0.7,
        emerging_risks: [],
        key_drivers: [],
        board_summary: "Summary text",
      })
      const { unmount } = renderPage()
      expect(screen.getByText("Summary text")).toBeInTheDocument()
      unmount()

      // Missing score_30d/emerging_risks -- must not crash, must not render.
      mockRunsFor("PREDICT", { score_7d: 42, trend: "worsening" })
      expect(() => renderPage()).not.toThrow()
      expect(screen.queryByText("Summary text")).not.toBeInTheDocument()
    })

    it("renders the mitigations panel for a well-formed result and rejects a malformed one", () => {
      mockRunsFor("MITIGATIONS", {
        mitigations: [
          {
            risk_id: "r1",
            risk_name: "Ransomware exposure",
            actions: [
              {
                title: "Patch VPN",
                description: "d",
                mitigation_type: "prevent",
                owner: "IT",
                priority: "high",
                effectiveness_score: 0.8,
                risk_reduction: 0.5,
              },
            ],
          },
        ],
      })
      const { unmount } = renderPage()
      expect(screen.getByText("Ransomware exposure")).toBeInTheDocument()
      unmount()

      // mitigations entries present but missing `actions` -- must not crash.
      mockRunsFor("MITIGATIONS", {
        mitigations: [{ risk_id: "r1", risk_name: "X" }],
      })
      expect(() => renderPage()).not.toThrow()
      expect(screen.queryByText("Ransomware exposure")).not.toBeInTheDocument()
    })

    // aexa-frontend#540: risk_name was plain text with no way to jump to
    // the risk it mitigates, unlike the identical risk_id cross-link this
    // page already had for item.created_risk_id.
    it("links the mitigation panel's risk name to its risk detail page (#540)", () => {
      mockRunsFor("MITIGATIONS", {
        mitigations: [
          {
            risk_id: "risk-77",
            risk_name: "Ransomware exposure",
            actions: [],
          },
        ],
      })

      renderPage()

      const link = screen.getByRole("link", { name: "Ransomware exposure" })
      expect(link).toHaveAttribute("href", "/organization/risks/risk-77")
    })

    it("renders the RCSA panel for a well-formed result and rejects a malformed one", () => {
      mockRunsFor("RCSA", {
        rcsa_date: "2026-01-01",
        assessment_period: "Q1",
        risk_universe: [],
        control_environment_score: 70,
        overall_risk_appetite: "Moderate",
        key_control_deficiencies: ["Gap A"],
        management_actions: [],
      })
      const { unmount } = renderPage()
      expect(screen.getByText("Gap A")).toBeInTheDocument()
      unmount()

      // risk_universe present but key_control_deficiencies missing.
      mockRunsFor("RCSA", { risk_universe: [] })
      expect(() => renderPage()).not.toThrow()
      expect(screen.queryByText("Gap A")).not.toBeInTheDocument()
    })

    it("renders the resilience-scan panel for a well-formed result and rejects a malformed one", () => {
      mockRunsFor("RESILIENCE_SCAN", {
        analysis_date: "2026-01-01",
        company_context: "ctx",
        immediate_alerts: [],
        resilience_score: {
          overall: 60,
          supply_chain: 55,
          financial: 65,
          geopolitical: 50,
          trend: "stable",
          top_vulnerabilities: ["Single-source supplier"],
        },
      })
      const { unmount } = renderPage()
      expect(
        screen.getByText("Single-source supplier")
      ).toBeInTheDocument()
      unmount()

      // resilience_score present but missing top_vulnerabilities/immediate_alerts.
      mockRunsFor("RESILIENCE_SCAN", {
        resilience_score: { overall: 60 },
      })
      expect(() => renderPage()).not.toThrow()
      expect(
        screen.queryByText("Single-source supplier")
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#253: search/severity are now server-side filters passed
  // through to the query hook, not a client-side re-filter of the current
  // page's items.
  it("passes the debounced search term to the query hook as searchTerm", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    })
    renderPage()
    mockUseGetIntelligenceItemsQuery.mockClear()

    const searchInput = screen.getByPlaceholderText(
      "organization.intelligence.filters.searchPlaceholder"
    )
    await user.type(searchInput, "ransomware")
    vi.advanceTimersByTime(500)

    await waitFor(() =>
      expect(mockUseGetIntelligenceItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "ransomware" })
      )
    )
    vi.useRealTimers()
  })

  it("passes the selected severity to the query hook as severity", async () => {
    renderPage()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.filters.severity_critical",
      })
    )

    await waitFor(() =>
      expect(mockUseGetIntelligenceItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "critical" })
      )
    )
  })

  it("does not pass a severity filter when 'all' is selected", () => {
    renderPage()

    expect(mockUseGetIntelligenceItemsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ severity: undefined })
    )
  })

  it("resets to page 1 when the search term changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    })
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [],
                meta: { page: 1, limit: 20, total: 0, totalPage: 3 },
              },
            }
    )
    renderPage()

    // Go to page 2 first.
    await user.click(
      screen.getByRole("button", {
        name: "organization.intelligence.pagination.next",
      })
    )
    mockUseGetIntelligenceItemsQuery.mockClear()

    const searchInput = screen.getByPlaceholderText(
      "organization.intelligence.filters.searchPlaceholder"
    )
    await user.type(searchInput, "x")
    vi.advanceTimersByTime(500)

    await waitFor(() =>
      expect(mockUseGetIntelligenceItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      )
    )
    vi.useRealTimers()
  })

  it("resets to page 1 when the severity filter changes", async () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [],
                meta: { page: 1, limit: 20, total: 0, totalPage: 3 },
              },
            }
    )
    renderPage()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.pagination.next",
      })
    )
    mockUseGetIntelligenceItemsQuery.mockClear()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.intelligence.filters.severity_high",
      })
    )

    await waitFor(() =>
      expect(mockUseGetIntelligenceItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      )
    )
  })

  it("shows the item count from server meta.total, not a client-computed length", () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 47, totalPage: 3 },
              },
            }
    )

    renderPage()

    expect(
      screen.getByText(
        "organization.intelligence.sections.itemsCount:47"
      )
    ).toBeInTheDocument()
  })

  // aexa-frontend#466: severity quick-filter buttons showed active state via
  // color only, with no aria-pressed -- inconsistent with AlertsPage's
  // near-identical filter buttons.
  it("sets aria-pressed on the severity filter buttons to reflect the active filter", () => {
    renderPage()

    const allButton = screen.getByRole("button", {
      name: "organization.intelligence.filters.severity_all",
    })
    const criticalButton = screen.getByRole("button", {
      name: "organization.intelligence.filters.severity_critical",
    })
    expect(allButton).toHaveAttribute("aria-pressed", "true")
    expect(criticalButton).toHaveAttribute("aria-pressed", "false")
  })

  it("updates aria-pressed after clicking a different severity filter", async () => {
    renderPage()

    const criticalButton = screen.getByRole("button", {
      name: "organization.intelligence.filters.severity_critical",
    })
    await userEvent.click(criticalButton)

    expect(criticalButton).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", {
        name: "organization.intelligence.filters.severity_all",
      })
    ).toHaveAttribute("aria-pressed", "false")
  })

  // aexa-frontend#466: the page went straight from h1 to h3 with no h2 --
  // the section panels/items-count heading must sit at h2 to keep the
  // hierarchy unbroken.
  it("does not skip heading levels from h1 to h3", () => {
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [makeItem()],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1)
    // The "N Intelligence Items" section title is the only heading below
    // h1 when no AI-run panels are rendered -- it must be h2, not h3.
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole("heading", { level: 3 }).length).toBe(0)
  })

  it("does not show Create Risk for an item that has not been analyzed yet", () => {
    mockRole = "ADMIN"
    mockUseGetIntelligenceItemsQuery.mockImplementation(
      (args: { analyzed?: boolean }) =>
        args.analyzed === false
          ? emptyItemsResult
          : {
              data: {
                data: [
                  makeItem({
                    analyzed_at: null,
                    severity: null,
                    is_risk: null,
                  }),
                ],
                meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
              },
            }
    )

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: "organization.intelligence.item.createRisk",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.intelligence.item.notAnalyzedYet")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("riskLevel.medium")
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#508 round 13 -- the search input relied on placeholder
  // text alone, with no aria-label/associated label giving it an accessible
  // name.
  it("gives the search input an accessible name", () => {
    renderPage()

    expect(
      screen.getByRole("textbox", {
        name: "organization.intelligence.filters.searchLabel",
      })
    ).toBeInTheDocument()
  })
})
