import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import ThreeLinesOfDefensePage from "./ThreeLinesOfDefensePage"

// aexa-frontend#532: ItemRow titles are now Links to the entity's detail
// page, so this needs a Router context -- same convention as
// InspectionTable.test.tsx's renderTable().
function renderPage() {
  return render(
    <MemoryRouter>
      <ThreeLinesOfDefensePage />
    </MemoryRouter>
  )
}

// quality-bar-loop round 4 (UX, round-1 finding): the per-line "move to"
// buttons were replaced by a single dropdown trigger (aria-label doesn't
// vary by row since the i18n mock below doesn't interpolate {{title}}),
// so tests locate a specific row's trigger via its known title text, then
// open the menu and click the destination by its own (still per-line,
// still meaningfully distinct) label.
function rowFor(title: string): HTMLElement {
  return screen.getByText(title).closest(".rounded-md") as HTMLElement
}

// quality-bar-loop round 10 (industry-standards, round-7 finding):
// reassigning now requires confirming in an AlertDialog before the
// mutation fires -- this helper clicks through both steps so existing
// callers (which assert on the eventual mutation call) don't all need
// updating individually. The "reassignment confirmation dialog (round
// 10)" describe block below tests the confirm step itself, so it drives
// the flow one click at a time instead of using this helper.
async function moveViaDropdown(trigger: HTMLElement, destinationKey: string) {
  await userEvent.click(trigger)
  const menuItem = await screen.findByRole("menuitem", {
    name: destinationKey,
  })
  await userEvent.click(menuItem)
  const confirmButton = await screen.findByRole("button", {
    name: "organization.threeLinesOfDefense.confirmReassignConfirm",
  })
  await userEvent.click(confirmButton)
}

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce the humanized-label bug (raw backend enum/domain values like
// "cyber", "non_compliant", "TO_DO" rendered directly instead of going
// through a label map + t()), since there'd be no way to tell "the key was
// resolved to a humanized string" apart from "the raw value was rendered
// unchanged" without real translations loaded. Overriding just the specific
// keys the meta-line label maps resolve to, with plausible humanized English,
// lets the tests confirm the humanized label (not the raw enum) actually
// renders -- every other key still falls back to itself unchanged. Same
// technique as CompliancePage.test.tsx.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  const HUMANIZED: Record<string, string> = {
    "organization.riskCategories.catCyber": "Cyber",
    "organization.riskRegister.statusOpen": "Open",
    "organization.findings.priorityHigh": "High",
    "organization.findings.statusToDo": "To Do",
    "organization.kri.status.ok": "OK",
    "organization.compliance.domains.data_protection": "Data Protection",
    "organization.compliance.status.non_compliant": "Non-Compliant",
    "organization.audit.statusPlanned": "Planned",
  }
  return {
    ...mod,
    useTranslation: () => ({
      t: (key: string) => HUMANIZED[key] ?? key,
    }),
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

// Role hook is mocked per-test via this mutable holder, same convention as
// RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

const mockUseGetThreeLinesOfDefenseQuery = vi.fn()
vi.mock("@/redux/apis/organization/governance.api", () => ({
  useGetThreeLinesOfDefenseQuery: (...args: unknown[]) =>
    mockUseGetThreeLinesOfDefenseQuery(...args),
}))

const mockUpdateRisk = vi.fn()
const mockRecordRiskLineReview = vi.fn()
vi.mock("@/redux/apis/organization/risk.api", () => ({
  useUpdateRiskMutation: () => [mockUpdateRisk, { isLoading: false }],
  useRecordRiskLineReviewMutation: () => [
    mockRecordRiskLineReview,
    { isLoading: false },
  ],
}))

const mockUpdateFindingById = vi.fn()
const mockRecordFindingLineReview = vi.fn()
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useUpdateFindingByIdMutation: () => [mockUpdateFindingById, { isLoading: false }],
  useRecordFindingLineReviewMutation: () => [
    mockRecordFindingLineReview,
    { isLoading: false },
  ],
}))

const mockUpdateKri = vi.fn()
const mockRecordKriLineReview = vi.fn()
vi.mock("@/redux/apis/organization/kri.api", () => ({
  useUpdateKriMutation: () => [mockUpdateKri, { isLoading: false }],
  useRecordKriLineReviewMutation: () => [
    mockRecordKriLineReview,
    { isLoading: false },
  ],
}))

const mockUpdateCompliance = vi.fn()
const mockRecordComplianceLineReview = vi.fn()
vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useUpdateComplianceMutation: () => [mockUpdateCompliance, { isLoading: false }],
  useRecordComplianceLineReviewMutation: () => [
    mockRecordComplianceLineReview,
    { isLoading: false },
  ],
}))

const mockUpdateAuditEngagement = vi.fn()
const mockRecordAuditEngagementLineReview = vi.fn()
vi.mock("@/redux/apis/organization/audit.api", () => ({
  useUpdateAuditEngagementMutation: () => [
    mockUpdateAuditEngagement,
    { isLoading: false },
  ],
  useRecordAuditEngagementLineReviewMutation: () => [
    mockRecordAuditEngagementLineReview,
    { isLoading: false },
  ],
}))

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      risks: [
        {
          id: "risk-1",
          title: "Supply chain disruption",
          category: "supply_chain",
          status: "open",
          line_of_defense: "FIRST",
          line_reviews: [],
        },
      ],
      actions: [
        {
          id: "action-1",
          title: "Patch critical vulnerability",
          priority: "High",
          status: "TO_DO",
          line_of_defense: "SECOND",
          line_reviews: [],
        },
        {
          id: "action-unclassified",
          title: "Legacy remediation item",
          priority: "Low",
          status: "IN_PROGRESS",
          line_of_defense: null,
          line_reviews: [],
        },
      ],
      kris: [
        {
          id: "kri-1",
          title: "Supplier Lead Time",
          unit: "days",
          status: "OK",
          line_of_defense: "SECOND",
          line_reviews: [],
        },
      ],
      complianceObligations: [
        {
          id: "compliance-1",
          title: "GDPR data mapping",
          domain: "data_protection",
          status: "compliant",
          line_of_defense: "SECOND",
          line_reviews: [],
        },
      ],
      auditEngagements: [
        {
          id: "audit-1",
          title: "Q3 internal audit",
          status: "planned",
          lead_auditor: "Jane Doe",
          line_of_defense: "THIRD",
          line_reviews: [],
        },
      ],
      ...overrides,
    },
  }
}

describe("ThreeLinesOfDefensePage", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockUseGetThreeLinesOfDefenseQuery.mockReset()
    mockUpdateRisk.mockReset()
    mockUpdateFindingById.mockReset()
    mockUpdateKri.mockReset()
    mockUpdateCompliance.mockReset()
    mockUpdateAuditEngagement.mockReset()
    mockRecordRiskLineReview.mockReset()
    mockRecordFindingLineReview.mockReset()
    mockRecordKriLineReview.mockReset()
    mockRecordComplianceLineReview.mockReset()
    mockRecordAuditEngagementLineReview.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
  })

  it("renders all 3 lines with items from multiple entity types", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    // Line names also appear in the round-6 coverage overview's legend
    // (plain text, not a heading), so scope to the h2 column headings.
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.first",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.second",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.third",
      })
    ).toBeInTheDocument()

    // Items land in their respective line: risk in 1st, kri+compliance+action
    // in 2nd, audit in 3rd.
    expect(screen.getByText("Supply chain disruption")).toBeInTheDocument()
    expect(screen.getByText("Patch critical vulnerability")).toBeInTheDocument()
    expect(screen.getByText("Supplier Lead Time")).toBeInTheDocument()
    expect(screen.getByText("GDPR data mapping")).toBeInTheDocument()
    expect(screen.getByText("Q3 internal audit")).toBeInTheDocument()
  })

  // quality-bar-loop round 7 (resilience, fresh-audit finding): an
  // unrecognized line_of_defense value (legacy data, a typo, a new line
  // added server-side before the client's LINES array catches up) used to
  // throw inside groupByLine's unguarded `grouped[item.line_of_defense]`
  // index, crashing the whole board over one malformed record. It should
  // now be safely omitted from its line instead.
  it("does not crash when a record has an unrecognized line_of_defense value", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData({
        risks: [
          {
            id: "risk-bad-line",
            title: "Malformed legacy risk",
            category: "supply_chain",
            status: "open",
            line_of_defense: "FOURTH_LINE_THAT_DOES_NOT_EXIST",
            line_reviews: [],
          },
          // A valid sibling record alongside the malformed one, to prove
          // the bounds-check guard only skips the bad record and doesn't
          // disturb grouping for everything else.
          {
            id: "risk-good-line",
            title: "Well-formed risk",
            category: "supply_chain",
            status: "open",
            line_of_defense: "SECOND",
            line_reviews: [],
          },
        ],
      }),
      isLoading: false,
    })

    expect(() => renderPage()).not.toThrow()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.first",
      })
    ).toBeInTheDocument()
    // The malformed record has nowhere valid to land, so it's omitted
    // rather than crashing or silently appearing in the wrong line.
    expect(screen.queryByText("Malformed legacy risk")).not.toBeInTheDocument()
    // The valid sibling record still lands in its correct line.
    expect(
      within(rowFor("Well-formed risk")).getByText("Well-formed risk")
    ).toBeInTheDocument()
  })

  // #97: the IIA Three Lines Model's central diagnostic question -- "is 3rd
  // line (independent assurance) reviewing enough of what 1st line
  // (operations) owns" -- can only be answered honestly once ownership and
  // review are two separate facts. CoverageOverview was rewritten from a
  // per-line ownership headcount bar (round 6/#939) to a review-coverage
  // panel: rings for the lines that actually PERFORM independent review
  // (2nd/3rd/governing body) plus a gap callout for items nobody
  // independent has reviewed yet. See CoverageOverview's own doc comment
  // in the source for the full history.
  describe("coverage overview (#97 review-coverage rewrite)", () => {
    // The line names also appear inside the per-line column cards, so
    // every assertion here is scoped to the coverage panel's own Card via
    // its unique "Coverage Overview" heading.
    function coverageCard(): HTMLElement {
      return screen
        .getByText("organization.threeLinesOfDefense.coverage.title")
        .closest('[data-slot="card"]') as HTMLElement
    }

    // Locates a single CoverageRing's wrapper <div> via its own line-name
    // label (a plain <span>, not a heading), so a test can inspect that
    // ring's svg <text> (the literal "count/total" string, not run through
    // the interpolation-blind t() mock) without conflating it with the
    // other 2 rings' labels.
    function ringFor(card: HTMLElement, lineLabelKey: string): HTMLElement {
      const label = within(card).getByText(lineLabelKey)
      return label.parentElement as HTMLElement
    }

    const FIRST_LABEL = "organization.threeLinesOfDefense.lines.first"
    const SECOND_LABEL = "organization.threeLinesOfDefense.lines.second"
    const THIRD_LABEL = "organization.threeLinesOfDefense.lines.third"
    const GOVERNING_BODY_LABEL =
      "organization.threeLinesOfDefense.lines.governingBody"

    it("shows a 'no items yet' message when there is genuinely no data at all", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [],
          actions: [],
          kris: [],
          complianceObligations: [],
          auditEngagements: [],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      expect(
        within(card).getByText("organization.threeLinesOfDefense.coverage.none")
      ).toBeInTheDocument()
      expect(card.querySelector('svg[role="img"]')).toBeNull()
    })

    it("shows a distinct onboarding empty state when items exist but no reviews have been recorded yet", () => {
      // Default makeData: 6 items total (risk-1, action-1,
      // action-unclassified, kri-1, compliance-1, audit-1), every one with
      // line_reviews: [] -- the expected first-use state.
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.noReviewsYet"
        )
      ).toBeInTheDocument()
      // Distinct from the total===0 empty state.
      expect(
        within(card).queryByText("organization.threeLinesOfDefense.coverage.none")
      ).not.toBeInTheDocument()
      expect(card.querySelector('svg[role="img"]')).toBeNull()
    })

    it("renders rings for SECOND, THIRD, and GOVERNING_BODY (not FIRST) with the correct count/total once reviews exist", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "SECOND", reviewedById: "u1", reviewedAt: "2026-01-01" },
              ],
            },
          ],
          auditEngagements: [
            {
              id: "audit-1",
              title: "Q3 internal audit",
              status: "planned",
              lead_auditor: "Jane Doe",
              line_of_defense: "THIRD",
              line_reviews: [
                { line: "THIRD", reviewedById: "u2", reviewedAt: "2026-01-01" },
              ],
            },
          ],
          kris: [
            {
              id: "kri-1",
              title: "Supplier Lead Time",
              unit: "days",
              status: "OK",
              line_of_defense: "SECOND",
              line_reviews: [
                {
                  line: "GOVERNING_BODY",
                  reviewedById: "u3",
                  reviewedAt: "2026-01-01",
                },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      // Total = 6 items (risk-1, action-1, action-unclassified, kri-1,
      // compliance-1, audit-1). 1 has a SECOND review, 1 has a THIRD
      // review, 1 has a GOVERNING_BODY review.
      expect(
        within(ringFor(card, SECOND_LABEL)).getByText("1/6")
      ).toBeInTheDocument()
      expect(
        within(ringFor(card, THIRD_LABEL)).getByText("1/6")
      ).toBeInTheDocument()
      expect(
        within(ringFor(card, GOVERNING_BODY_LABEL)).getByText("1/6")
      ).toBeInTheDocument()
      // FIRST-line "coverage" would just restate near-100% ownership, so
      // no ring renders for it.
      expect(within(card).queryByText(FIRST_LABEL)).not.toBeInTheDocument()
      // quality-bar-loop round 7 (industry-standards): rings are now
      // clickable drill-down buttons -- the accessible name (and role)
      // moved from the svg (now aria-hidden) to the wrapping button.
      expect(
        within(card).getAllByRole("button", {
          name: "organization.threeLinesOfDefense.coverage.ringLabel",
        })
      ).toHaveLength(3)
    })

    it("shows the gap callout listing items with no SECOND or THIRD line review", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "SECOND", reviewedById: "u1", reviewedAt: "2026-01-01" },
              ],
            },
          ],
          // kri-1 only has a GOVERNING_BODY review -- oversight of the
          // process isn't independent review of the item's content, so
          // it's still a gap.
          kris: [
            {
              id: "kri-1",
              title: "Supplier Lead Time",
              unit: "days",
              status: "OK",
              line_of_defense: "SECOND",
              line_reviews: [
                {
                  line: "GOVERNING_BODY",
                  reviewedById: "u3",
                  reviewedAt: "2026-01-01",
                },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      // Gap items: action-1, action-unclassified, kri-1, compliance-1,
      // audit-1 (5 of the 6 total items) -- risk-1 has a SECOND review so
      // it's excluded.
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.gapTitle_other"
        )
      ).toBeInTheDocument()
      expect(
        within(card).getByText("Patch critical vulnerability")
      ).toBeInTheDocument()
      expect(
        within(card).getByText("Supplier Lead Time")
      ).toBeInTheDocument()
      expect(within(card).getByText("GDPR data mapping")).toBeInTheDocument()
      expect(within(card).getByText("Q3 internal audit")).toBeInTheDocument()
      expect(
        within(card).queryByText("Supply chain disruption")
      ).not.toBeInTheDocument()
    })

    it("uses the singular gap title when exactly one item lacks independent review", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [],
            },
          ],
          actions: [],
          kris: [],
          complianceObligations: [],
          auditEngagements: [
            {
              id: "audit-1",
              title: "Q3 internal audit",
              status: "planned",
              lead_auditor: "Jane Doe",
              line_of_defense: "THIRD",
              line_reviews: [
                { line: "THIRD", reviewedById: "u2", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      // Total 2 items: audit-1 has a THIRD review (not a gap), risk-1 has
      // none (the single gap item) -- exercises the count===1 branch.
      const card = coverageCard()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.gapTitle_one"
        )
      ).toBeInTheDocument()
      expect(
        within(card).queryByText(
          "organization.threeLinesOfDefense.coverage.gapTitle_other"
        )
      ).not.toBeInTheDocument()
    })

    it("does not show the gap callout once every item has a covering SECOND or THIRD review", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "SECOND", reviewedById: "u1", reviewedAt: "2026-01-01" },
              ],
            },
          ],
          actions: [],
          kris: [],
          complianceObligations: [],
          auditEngagements: [],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      expect(within(card).queryByRole("status")).not.toBeInTheDocument()
      expect(
        within(card).queryByText(
          "organization.threeLinesOfDefense.coverage.gapTitle_other"
        )
      ).not.toBeInTheDocument()
    })

    it("shows '+N more' once there are more than 5 gap items, listing only the first 5 titles", () => {
      const manyUnreviewedRisks = Array.from({ length: 6 }, (_, i) => ({
        id: `risk-${i}`,
        title: `Unreviewed risk ${i}`,
        category: "supply_chain",
        status: "open",
        line_of_defense: "FIRST",
        line_reviews: [],
      }))

      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: manyUnreviewedRisks,
          actions: [],
          kris: [],
          complianceObligations: [],
          auditEngagements: [
            {
              id: "audit-1",
              title: "Q3 internal audit",
              status: "planned",
              lead_auditor: "Jane Doe",
              line_of_defense: "THIRD",
              line_reviews: [
                { line: "THIRD", reviewedById: "u2", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      // 6 unreviewed risks are gap items (audit-1 has a THIRD review, so
      // it's the only non-gap item).
      for (let i = 0; i < 5; i++) {
        expect(
          within(card).getByText(`Unreviewed risk ${i}`)
        ).toBeInTheDocument()
      }
      expect(
        within(card).queryByText("Unreviewed risk 5")
      ).not.toBeInTheDocument()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.gapMore"
        )
      ).toBeInTheDocument()
    })

    it("shows the item-count subtitle, pluralized by total item count", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [],
          actions: [],
          kris: [],
          complianceObligations: [],
          auditEngagements: [
            {
              id: "audit-1",
              title: "Q3 internal audit",
              status: "planned",
              lead_auditor: "Jane Doe",
              line_of_defense: "THIRD",
              line_reviews: [],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.subtitle"
        )
      ).toBeInTheDocument()
    })

    it("shows an always-visible legend distinguishing independent from self-review once reviews exist", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "SECOND", reviewedById: "u1", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.legendIndependent"
        )
      ).toBeInTheDocument()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.coverage.legendSelf"
        )
      ).toBeInTheDocument()
    })

    it("does not show the review-type legend in the onboarding empty state (no reviews yet)", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()
      expect(
        within(card).queryByText(
          "organization.threeLinesOfDefense.coverage.legendIndependent"
        )
      ).not.toBeInTheDocument()
    })

    // quality-bar-loop round 7 (industry-standards, round-1 finding):
    // reference GRC tools (AuditBoard, LogicManager, Resolver) let a user
    // drill from a coverage ring into the items behind it -- these tests
    // exercise that click-to-highlight interaction end to end.
    describe("drill-down: clicking a ring highlights reviewed items (round 7)", () => {
      function makeDrilldownData() {
        return makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "SECOND", reviewedById: "u1", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        })
      }

      it("renders coverage rings as buttons with an accessible name and no separate img role", () => {
        mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
          data: makeDrilldownData(),
          isLoading: false,
        })

        renderPage()

        const card = coverageCard()
        const ringButtons = within(card).getAllByRole("button", {
          name: "organization.threeLinesOfDefense.coverage.ringLabel",
        })
        expect(ringButtons).toHaveLength(3)
        // Accessible name moved to the button (aria-hidden svg underneath),
        // not left duplicated as a second img-role element.
        expect(card.querySelectorAll('svg[role="img"]')).toHaveLength(0)
        for (const button of ringButtons) {
          expect(button).toHaveAttribute("aria-pressed", "false")
        }
      })

      it("shows a static hint that rings are clickable, and hides it once a filter is active (round 8)", async () => {
        const user = userEvent.setup()
        mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
          data: makeDrilldownData(),
          isLoading: false,
        })

        renderPage()

        const card = coverageCard()
        expect(
          within(card).getByText(
            "organization.threeLinesOfDefense.coverage.ringHint"
          )
        ).toBeInTheDocument()

        await user.click(ringFor(card, SECOND_LABEL))

        expect(
          within(card).queryByText(
            "organization.threeLinesOfDefense.coverage.ringHint"
          )
        ).not.toBeInTheDocument()
      })

      it("highlights items reviewed by the clicked line, without dimming the rest (a11y: dimming via opacity would break text contrast)", async () => {
        const user = userEvent.setup()
        mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
          data: makeDrilldownData(),
          isLoading: false,
        })

        renderPage()

        const card = coverageCard()
        const secondRing = ringFor(card, SECOND_LABEL)
        await user.click(secondRing)

        expect(secondRing).toHaveAttribute("aria-pressed", "true")

        const reviewedRow = rowFor("Supply chain disruption")
        expect(reviewedRow.className).toContain("border-primary")
        expect(reviewedRow.className).not.toContain("opacity-40")

        // "Patch critical vulnerability" also appears as plain text in the
        // gap-list (it has no independent review, by definition a gap) --
        // rowFor's plain getByText would be ambiguous, so pick the match
        // that's an actual item row, not the gap-list <li>.
        const unreviewedRow = screen
          .getAllByText("Patch critical vulnerability")
          .map((el) => el.closest(".justify-between"))
          .find((el): el is HTMLElement => el !== null)!
        // No opacity-based dimming (measured to drop text contrast to
        // ~1.8-2.5:1, under WCAG 1.4.3's 4.5:1) -- non-matching rows stay
        // at full contrast, distinguished only by the ABSENCE of the
        // highlight, not by their own text becoming harder to read.
        expect(unreviewedRow.className).not.toContain("opacity-40")
        expect(unreviewedRow.className).not.toContain("border-primary")
      })

      it("shows a 'showing items reviewed by X' banner with a way to clear it", async () => {
        const user = userEvent.setup()
        mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
          data: makeDrilldownData(),
          isLoading: false,
        })

        renderPage()

        const card = coverageCard()
        expect(
          within(card).queryByText(
            "organization.threeLinesOfDefense.coverage.highlightActive"
          )
        ).not.toBeInTheDocument()

        const secondRing = ringFor(card, SECOND_LABEL)
        await user.click(secondRing)

        expect(
          within(card).getByText(
            "organization.threeLinesOfDefense.coverage.highlightActive"
          )
        ).toBeInTheDocument()

        await user.click(
          within(card).getByText(
            "organization.threeLinesOfDefense.coverage.clearHighlight"
          )
        )

        expect(
          within(card).queryByText(
            "organization.threeLinesOfDefense.coverage.highlightActive"
          )
        ).not.toBeInTheDocument()
        expect(rowFor("Supply chain disruption").className).not.toContain(
          "border-primary"
        )
      })

      it("clicking the same ring twice toggles the highlight off", async () => {
        const user = userEvent.setup()
        mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
          data: makeDrilldownData(),
          isLoading: false,
        })

        renderPage()

        const card = coverageCard()
        const secondRing = ringFor(card, SECOND_LABEL)
        await user.click(secondRing)
        expect(secondRing).toHaveAttribute("aria-pressed", "true")

        await user.click(secondRing)
        expect(secondRing).toHaveAttribute("aria-pressed", "false")
        expect(rowFor("Supply chain disruption").className).not.toContain(
          "border-primary"
        )
      })
    })
  })

  // aexa-frontend#465 -- the page previously had only one <h1> then jumped
  // straight to <h4> (CardTitle rendered a plain div, not a heading, so it
  // never filled the h2/h3 gap). Assert the full heading level sequence is
  // contiguous (no skipped levels) rather than just that headings exist.
  it("has a contiguous heading hierarchy with no skipped levels", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const levels = screen
      .getAllByRole("heading")
      .map((el) => Number(el.tagName[1]))

    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
    // Sanity check the fix actually introduced h2s and h3s, not just that
    // nothing skips (a page with only an h1 would trivially pass the loop
    // above).
    expect(levels).toContain(2)
    expect(levels).toContain(3)
  })

  it("gives each truncated item title a hover tooltip via the title attribute", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const title = screen.getByText("Supply chain disruption")
    expect(title).toHaveAttribute("title", "Supply chain disruption")
  })

  // quality-bar-loop round 5 (visual polish, round-1 finding):
  // single-line `truncate` cut titles off aggressively even at wide
  // viewports. line-clamp-2 shows more of the title before falling
  // back to the tooltip (still kept, for the rare longer case).
  it("clamps item titles to 2 lines instead of a single truncated line", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const title = screen.getByText("Supply chain disruption")
    expect(title.className).toContain("line-clamp-2")
    expect(title.className).not.toContain("truncate")
  })

  // quality-bar-loop round 5 (visual polish, round-1 finding):
  // live-observed severe column imbalance -- up to 23 items in one
  // line vs. 2-3 in others, with no independent scroll the whole grid
  // row stretched to the tallest column, leaving large dead whitespace
  // under short ones. Each column now bounds its own height and
  // scrolls internally.
  it("bounds each line's card content to a fixed height with independent scroll", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const cardContent = screen
      .getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.first",
      })
      .closest('[data-slot="card"]')!
      .querySelector('[data-slot="card-content"]')!
    expect(cardContent.className).toContain("max-h-")
    expect(cardContent.className).toContain("overflow-y-auto")
  })

  // aexa-frontend#939 (visual polish loop, round-3 finding): the previous
  // xl:grid-cols-4 breakpoint put all 4 line columns into effect at
  // 1280px, live-measured to give each card only ~235px of usable width
  // and cause the majority of titles to wrap. 4 columns now only kick in
  // at the wider 2xl breakpoint; xl (the realistic 1280-1535px desktop
  // range) gets 2 wider columns instead.
  it("only reaches 4 line columns at the wider 2xl breakpoint, not the first desktop breakpoint", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const grid = screen
      .getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.first",
      })
      .closest('[data-slot="card"]')!.parentElement!
    expect(grid.className).toContain("grid-cols-1")
    expect(grid.className).toContain("md:grid-cols-2")
    expect(grid.className).toContain("xl:grid-cols-2")
    expect(grid.className).toContain("2xl:grid-cols-4")
    // "2xl:grid-cols-4" itself contains "xl:grid-cols-4" as a substring, so
    // this checks the space-separated token list instead of a bare
    // toContain -- that would trivially "pass" against the 2xl variant
    // even if the bad xl:grid-cols-4 class were still present.
    const classes = grid.className.split(/\s+/)
    expect(classes).not.toContain("xl:grid-cols-4")
  })

  // aexa-frontend#939 (visual polish loop, round-7 finding): without
  // items-start, CSS Grid's default align-items: stretch forced every
  // card in a row to match its tallest row-sibling's height -- a short
  // card's dead space moved inside its own visible card border instead
  // of being removed by round 5's per-card scroll cap.
  it("lets each line's card size to its own content instead of stretching to match its row", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const grid = screen
      .getByRole("heading", {
        level: 2,
        name: "organization.threeLinesOfDefense.lines.first",
      })
      .closest('[data-slot="card"]')!.parentElement!
    const classes = grid.className.split(/\s+/)
    expect(classes).toContain("items-start")
  })

  it("shows the Unclassified Actions bucket for an Action with a null line_of_defense", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.threeLinesOfDefense.unclassified.title")
    ).toBeInTheDocument()
    expect(screen.getByText("Legacy remediation item")).toBeInTheDocument()

    // The unclassified action must not also appear under a classified line.
    expect(screen.getAllByText("Legacy remediation item")).toHaveLength(1)
  })

  it("shows reassignment controls for an ADMIN", () => {
    mockRole = "ADMIN"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getAllByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      }).length
    ).toBeGreaterThan(0)
  })

  // quality-bar-loop round 4 (UX, round-1 finding): previously up to 3
  // "move to" buttons per row rendered the SAME ArrowRight icon with no
  // visible way to tell them apart -- a live-confirmed real friction
  // point ("which one do I click"). The unclassified action has the most
  // destinations (4, since it has no current line to exclude), so it's
  // the strongest case: every menu item must have its own distinct,
  // real text label, not a repeated icon-derived name.
  it("labels every reassignment destination with distinct text, not an identical icon", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const unclassifiedRow = rowFor("Legacy remediation item")
    await userEvent.click(
      within(unclassifiedRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      })
    )

    // #97: the menu now also has a "Record review" section below "Move
    // to" (this ADMIN-role item has all 3 non-THIRD lines recordable) --
    // scope to just the "Move to" destinations, which is what this test is
    // actually about.
    const menuItems = await screen.findAllByRole("menuitem")
    const moveLabels = menuItems
      .map((item) => item.textContent)
      .filter((text) => text?.startsWith("organization.threeLinesOfDefense.moveTo"))
    expect(moveLabels).toEqual([
      "organization.threeLinesOfDefense.moveToFirst",
      "organization.threeLinesOfDefense.moveToSecond",
      "organization.threeLinesOfDefense.moveToThird",
      "organization.threeLinesOfDefense.moveToGoverningBody",
    ])
    // Distinct labels, not 4 copies of the same string.
    expect(new Set(moveLabels).size).toBe(moveLabels.length)
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the old per-line
  // buttons measured 22x22px live. Round 4 replaced the row of buttons
  // with a single dropdown trigger, which keeps this same 44px target.
  it("gives the reassignment trigger a 44px touch target", () => {
    mockRole = "ADMIN"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const button = screen.getAllByRole("button", {
      name: "organization.threeLinesOfDefense.moveItem",
    })[0]
    expect(button.className).toContain("h-11")
    expect(button.className).toContain("w-11")
  })

  // quality-bar-loop round 9 (mobile, stuck at floor for 3 rounds): the
  // trigger button was already a correct 44px target, but the dropdown
  // menu items it opens inherited the shared DropdownMenuItem's default
  // min-h-7 (28px) -- under the WCAG 2.5.5 minimum despite the trigger
  // itself being compliant.
  it("gives each reassignment destination in the dropdown a 44px touch target", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    const unclassifiedRow = rowFor("Legacy remediation item")
    await userEvent.click(
      within(unclassifiedRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      })
    )

    const menuItems = await screen.findAllByRole("menuitem")
    expect(menuItems.length).toBeGreaterThan(0)
    for (const item of menuItems) {
      expect(item.className).toContain("min-h-11")
    }
  })

  it("shows reassignment controls for a LEAD_AUDITOR", () => {
    mockRole = "LEAD_AUDITOR"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getAllByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      }).length
    ).toBeGreaterThan(0)
  })

  it("hides reassignment controls for a VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      })
    ).not.toBeInTheDocument()
  })

  it("hides reassignment controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      })
    ).not.toBeInTheDocument()
  })

  it("calls updateRisk with line_of_defense when reassigning a risk", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    mockUpdateRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderPage()

    // Supply chain disruption risk is in FIRST -- open its move menu and
    // pick "Move to 2nd Line".
    const riskRow = rowFor("Supply chain disruption")
    await moveViaDropdown(
      within(riskRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      }),
      "organization.threeLinesOfDefense.moveToSecond"
    )

    await waitFor(() =>
      expect(mockUpdateRisk).toHaveBeenCalledWith({
        id: "risk-1",
        data: { line_of_defense: "SECOND" },
      })
    )
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
  })

  // quality-bar-loop round 10 (industry-standards, round-7 finding):
  // clicking a destination now opens a confirmation dialog instead of
  // firing the mutation immediately -- these three tests exercise the
  // confirmation step itself (dialog content, cancel path, confirm path)
  // rather than relying solely on moveViaDropdown's helper always
  // confirming.
  describe("reassignment confirmation dialog (round 10)", () => {
    it("shows a confirmation dialog naming the item and destination line before reassigning", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      })
      await userEvent.click(menuItem)

      // Review round 1 finding on PR #811: opening the dialog is now
      // deferred to the next animation frame (avoids a Radix focus fight
      // between the closing dropdown and the opening dialog), so this
      // needs an async query instead of a synchronous one.
      expect(
        await screen.findByText(
          "organization.threeLinesOfDefense.confirmReassignTitle"
        )
      ).toBeInTheDocument()
      // This file's mock t() (see the HUMANIZED map above) never
      // interpolates, only a fixed set of keys resolve to real text and
      // everything else falls back to the raw key -- same limitation
      // documented at the top of this file, so this only proves the
      // description key is rendered, not that title/line values flow
      // through it.
      expect(
        screen.getByText(
          "organization.threeLinesOfDefense.confirmReassignDescription"
        )
      ).toBeInTheDocument()

      // Mutation must NOT have fired yet -- only after confirming.
      expect(mockUpdateRisk).not.toHaveBeenCalled()
    })

    it("does not reassign when the confirmation dialog is cancelled", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      })
      await userEvent.click(menuItem)

      const cancelButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReassignCancel",
      })
      await userEvent.click(cancelButton)

      expect(
        screen.queryByText(
          "organization.threeLinesOfDefense.confirmReassignTitle"
        )
      ).not.toBeInTheDocument()
      expect(mockUpdateRisk).not.toHaveBeenCalled()
    })

    it("reassigns only after the confirmation dialog is confirmed", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await moveViaDropdown(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        }),
        "organization.threeLinesOfDefense.moveToSecond"
      )

      await waitFor(() =>
        expect(mockUpdateRisk).toHaveBeenCalledWith({
          id: "risk-1",
          data: { line_of_defense: "SECOND" },
        })
      )
    })

    // quality-bar-loop round 11 (resilience, round-9 regression finding):
    // a plain `if (confirmRequest)` check isn't enough to block a genuine
    // double-fire, since both `setConfirmRequest(null)` and `pendingIds`'
    // own update are React state setters batched to the next render -- a
    // second click landing before that render commits would still close
    // over the same pre-update `confirmRequest`. Both clicks are fired
    // inside a single `act()` call (not two separate `fireEvent.click()`
    // calls, which each auto-flush via their own implicit `act()` and so
    // never actually reproduce the race) so React only commits once
    // AFTER both onClick handlers have already run against the same
    // pre-update closure -- this is the actual race window the
    // `hasConfirmedRef` guard protects against, confirmed by a verified
    // negative control (this test genuinely fails without the guard).
    it("does not fire the mutation twice when the confirm button is double-clicked", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      })
      await userEvent.click(menuItem)

      const confirmButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReassignConfirm",
      })
      act(() => {
        fireEvent.click(confirmButton)
        fireEvent.click(confirmButton)
      })

      await waitFor(() =>
        expect(mockUpdateRisk).toHaveBeenCalledTimes(1)
      )
    })

    // Review round 2 (a11y, WCAG 2.4.3): confirming/cancelling used to
    // leave focus on <body>, forcing a keyboard user to re-Tab from the
    // page top to find their place again.
    it("returns focus to the row's trigger button after the dialog is confirmed", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      const trigger = within(riskRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      })
      await userEvent.click(trigger)
      const menuItem = await screen.findByRole("menuitem", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      })
      await userEvent.click(menuItem)

      const confirmButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReassignConfirm",
      })
      await userEvent.click(confirmButton)

      await waitFor(() => expect(trigger).toHaveFocus())
    })

    it("returns focus to the row's trigger button after the dialog is cancelled", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      const trigger = within(riskRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      })
      await userEvent.click(trigger)
      const menuItem = await screen.findByRole("menuitem", {
        name: "organization.threeLinesOfDefense.moveToSecond",
      })
      await userEvent.click(menuItem)

      const cancelButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReassignCancel",
      })
      await userEvent.click(cancelButton)

      await waitFor(() => expect(trigger).toHaveFocus())
    })
  })

  // Review round 1 (angle B) on PR #664: flagged as untested (a
  // pre-existing gap, not introduced by this PR, but cheap to close) --
  // the trigger is a native `disabled` button while a mutation is in
  // flight, so a disabled element can't receive focus/click/pointerdown,
  // which is what Radix's DropdownMenuTrigger listens on to open the
  // menu (browser-guaranteed native semantics, not custom logic here --
  // this test verifies the `isPending` -> `disabled` wiring itself).
  it("disables the reassignment trigger while a mutation is pending", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    let resolveUpdate: (value: { success: true }) => void = () => {}
    mockUpdateRisk.mockReturnValue({
      unwrap: () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        }),
    })

    renderPage()

    const riskRow = rowFor("Supply chain disruption")
    const trigger = within(riskRow).getByRole("button", {
      name: "organization.threeLinesOfDefense.moveItem",
    })
    await moveViaDropdown(
      trigger,
      "organization.threeLinesOfDefense.moveToSecond"
    )

    // The mutation is now in flight -- pendingId is set, the unwrap()
    // promise hasn't resolved yet.
    await waitFor(() => expect(trigger).toBeDisabled())

    resolveUpdate({ success: true })
    await waitFor(() => expect(trigger).not.toBeDisabled())
  })

  // quality-bar-loop round 8 (resilience, round-7 finding): a single
  // `pendingId` state meant starting a second row's reassign overwrote
  // the first row's pending id, re-enabling the first row's trigger
  // while its own mutation was still in flight -- risking a duplicate
  // reassignment on the first row. Each row's pending state must now be
  // tracked independently.
  it("keeps an earlier row's trigger disabled while a second, unrelated row's reassign is also in flight", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    let resolveRisk: (value: { success: true }) => void = () => {}
    mockUpdateRisk.mockReturnValue({
      unwrap: () =>
        new Promise((resolve) => {
          resolveRisk = resolve
        }),
    })
    let resolveKri: (value: { success: true }) => void = () => {}
    mockUpdateKri.mockReturnValue({
      unwrap: () =>
        new Promise((resolve) => {
          resolveKri = resolve
        }),
    })

    renderPage()

    const riskTrigger = within(
      rowFor("Supply chain disruption")
    ).getByRole("button", { name: "organization.threeLinesOfDefense.moveItem" })
    await moveViaDropdown(
      riskTrigger,
      "organization.threeLinesOfDefense.moveToSecond"
    )
    await waitFor(() => expect(riskTrigger).toBeDisabled())

    // Start a second, unrelated row's reassign while the risk's is still
    // pending. With a single shared pendingId, this would incorrectly
    // re-enable riskTrigger.
    const kriTrigger = within(
      rowFor("Supplier Lead Time")
    ).getByRole("button", { name: "organization.threeLinesOfDefense.moveItem" })
    await moveViaDropdown(
      kriTrigger,
      "organization.threeLinesOfDefense.moveToFirst"
    )
    await waitFor(() => expect(kriTrigger).toBeDisabled())
    expect(riskTrigger).toBeDisabled()

    resolveRisk({ success: true })
    await waitFor(() => expect(riskTrigger).not.toBeDisabled())
    // The still-in-flight kri mutation must remain unaffected by the
    // risk mutation resolving.
    expect(kriTrigger).toBeDisabled()

    resolveKri({ success: true })
    await waitFor(() => expect(kriTrigger).not.toBeDisabled())
  })

  it("calls updateFindingById with line_of_defense when reassigning an unclassified action", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderPage()

    // The unclassified action row offers all 4 lines since it has no
    // current line to exclude.
    const unclassifiedRow = rowFor("Legacy remediation item")
    await moveViaDropdown(
      within(unclassifiedRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      }),
      "organization.threeLinesOfDefense.moveToFirst"
    )

    await waitFor(() =>
      expect(mockUpdateFindingById).toHaveBeenCalledWith({
        id: "action-unclassified",
        body: { line_of_defense: "FIRST" },
      })
    )
  })

  it("shows an error toast when a reassignment mutation fails", async () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })
    mockUpdateRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Only ADMIN/LEAD_AUDITOR can do this" } }),
    })

    renderPage()

    const riskRow = rowFor("Supply chain disruption")
    await moveViaDropdown(
      within(riskRow).getByRole("button", {
        name: "organization.threeLinesOfDefense.moveItem",
      }),
      "organization.threeLinesOfDefense.moveToSecond"
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Only ADMIN/LEAD_AUDITOR can do this"
      )
    )
  })

  it("shows the loading state while the query is in flight", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    renderPage()

    expect(
      screen.getByText("organization.threeLinesOfDefense.loading")
    ).toBeInTheDocument()
  })

  // aexa-server#208 / aexa-frontend#209: GOVERNING_BODY column + the
  // per-entity-type permission split (Risk/Kri/Compliance now require ADMIN
  // specifically; AuditEngagement now requires LEAD_AUDITOR specifically;
  // Action is unchanged).
  describe("GOVERNING_BODY column (#209)", () => {
    it("renders a 4th Governing Body column alongside the original three", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "organization.threeLinesOfDefense.lines.governingBody",
        })
      ).toBeInTheDocument()
    })

    it("offers Move to Governing Body as a reassignment option for an ADMIN", async () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )

      expect(
        await screen.findByRole("menuitem", {
          name: "organization.threeLinesOfDefense.moveToGoverningBody",
        })
      ).toBeInTheDocument()
    })

    it("reassigns a risk to GOVERNING_BODY", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await moveViaDropdown(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        }),
        "organization.threeLinesOfDefense.moveToGoverningBody"
      )

      await waitFor(() =>
        expect(mockUpdateRisk).toHaveBeenCalledWith({
          id: "risk-1",
          data: { line_of_defense: "GOVERNING_BODY" },
        })
      )
    })
  })

  describe("per-entity-type reassignment permissions (#208)", () => {
    it("ADMIN can reassign Risk/Kri/Compliance (management line)", () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const riskRow = screen.getByText("Supply chain disruption").closest("div")!
        .parentElement!
        .parentElement!
      const kriRow = screen.getByText("Supplier Lead Time").closest("div")!
        .parentElement!
        .parentElement!
      const complianceRow = screen.getByText("GDPR data mapping").closest("div")!
        .parentElement!
        .parentElement!
      expect(riskRow.querySelector("button")).toBeInTheDocument()
      expect(kriRow.querySelector("button")).toBeInTheDocument()
      expect(complianceRow.querySelector("button")).toBeInTheDocument()
    })

    // #97: LEAD_AUDITOR still can't reassign OWNERSHIP of Risk/Kri/
    // Compliance -- but the dropdown trigger now also gates a second,
    // unrelated action (recording a THIRD-line review, which LEAD_AUDITOR
    // *can* do on any entity type -- see the "recording line reviews"
    // describe block below). So the trigger button itself can no longer be
    // used as a stand-in for "can reassign" -- these tests now open the
    // menu and assert the "Move to" section specifically is absent.
    it("LEAD_AUDITOR cannot reassign Risk/Kri/Compliance (management line requires ADMIN specifically)", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      for (const title of [
        "Supply chain disruption",
        "Supplier Lead Time",
        "GDPR data mapping",
      ]) {
        const row = rowFor(title)
        await userEvent.click(
          within(row).getByRole("button", {
            name: "organization.threeLinesOfDefense.moveItem",
          })
        )
        expect(
          screen.queryByText("organization.threeLinesOfDefense.moveToLabel")
        ).not.toBeInTheDocument()
        // Close the menu before moving to the next row.
        await userEvent.keyboard("{Escape}")
      }
    })

    it("LEAD_AUDITOR CAN reassign an AuditEngagement (audit line)", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const auditRow = rowFor("Q3 internal audit")
      await userEvent.click(
        within(auditRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      expect(
        await screen.findByText(
          "organization.threeLinesOfDefense.moveToLabel"
        )
      ).toBeInTheDocument()
    })

    it("ADMIN cannot reassign an AuditEngagement (audit line requires LEAD_AUDITOR specifically)", async () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const auditRow = rowFor("Q3 internal audit")
      await userEvent.click(
        within(auditRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      expect(
        screen.queryByText("organization.threeLinesOfDefense.moveToLabel")
      ).not.toBeInTheDocument()
    })

    it("both ADMIN and LEAD_AUDITOR can reassign an Action (unchanged)", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      mockRole = "ADMIN"
      const { unmount } = renderPage()
      let actionRow = screen.getByText("Patch critical vulnerability").closest("div")!
        .parentElement!
        .parentElement!
      expect(actionRow.querySelector("button")).toBeInTheDocument()
      unmount()

      mockRole = "LEAD_AUDITOR"
      renderPage()
      actionRow = screen.getByText("Patch critical vulnerability").closest("div")!
        .parentElement!
        .parentElement!
      expect(actionRow.querySelector("button")).toBeInTheDocument()
    })

    // #97: the trigger button itself now also renders for a LEAD_AUDITOR on
    // this row (they can record a THIRD-line review even though they can't
    // reassign ownership), so the real regression check is that the
    // reassignment mutation specifically is never attempted -- not that no
    // button exists at all.
    it("does not attempt updateCompliance when a LEAD_AUDITOR has no reassignment option to click (server 403 avoided client-side)", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const complianceRow = rowFor("GDPR data mapping")
      await userEvent.click(
        within(complianceRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      expect(
        screen.queryByText("organization.threeLinesOfDefense.moveToLabel")
      ).not.toBeInTheDocument()
      expect(mockUpdateCompliance).not.toHaveBeenCalled()
    })
  })

  // #97: recording that a line independently reviewed an item is a
  // separate action from reassigning who owns it -- canRecordReviewForLine
  // mirrors the backend's assertCanRecordLineReview exactly: THIRD-line
  // review requires LEAD_AUDITOR, every other line requires ADMIN, and
  // (unlike ownership reassignment) this permission applies uniformly
  // across every entity type.
  describe("recording line reviews (#97)", () => {
    // This file's mock t() never interpolates (see the HUMANIZED map
    // comment at the top), so every "Mark reviewed by X" menu item renders
    // the SAME raw "recordReviewFor" key regardless of which line it's for
    // -- unlike "Move to" (MOVE_TO_KEY uses a distinct hardcoded key per
    // line). Tests below distinguish which line a record-review item
    // targets either by using rows/roles where only one line is ever
    // recordable, or by the line-specific color class on each item's
    // ShieldCheck icon (LINE_COLOR_TEXT, the same palette the coverage
    // rings and review dots use).
    function recordReviewIcons(menu: HTMLElement): SVGElement[] {
      return Array.from(menu.querySelectorAll("svg.lucide-shield-check"))
    }

    it("shows an ADMIN 'Mark reviewed by' options for 1st/2nd Line and Governing Body but not 3rd Line", async () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Audit's reassignment requires LEAD_AUDITOR specifically, so an
      // ADMIN's dropdown on the audit row contains ONLY record-review
      // items -- no "Move to" items to disambiguate from.
      const auditRow = rowFor("Q3 internal audit")
      await userEvent.click(
        within(auditRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menu = (await screen.findAllByRole("menuitem"))[0]
        .closest('[role="menu"]') as HTMLElement

      expect(
        within(menu).getByText(
          "organization.threeLinesOfDefense.recordReviewLabel"
        )
      ).toBeInTheDocument()
      const icons = recordReviewIcons(menu)
      expect(icons).toHaveLength(3)
      expect(icons.some((i) => i.classList.contains("text-chart-1"))).toBe(
        true
      ) // FIRST
      expect(
        icons.some((i) => i.classList.contains("text-[hsl(250_70%_60%)]"))
      ).toBe(true) // SECOND
      expect(
        icons.some((i) => i.classList.contains("text-[hsl(88_55%_42%)]"))
      ).toBe(true) // GOVERNING_BODY
      expect(
        icons.some((i) => i.classList.contains("text-[hsl(320_65%_55%)]"))
      ).toBe(false) // THIRD absent
    })

    it("shows a LEAD_AUDITOR only the 3rd Line 'Mark reviewed by' option", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Risk reassignment requires ADMIN specifically, so a LEAD_AUDITOR's
      // dropdown on the risk row contains ONLY record-review items too.
      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menu = (await screen.findAllByRole("menuitem"))[0]
        .closest('[role="menu"]') as HTMLElement

      const icons = recordReviewIcons(menu)
      expect(icons).toHaveLength(1)
      expect(icons[0].classList.contains("text-[hsl(320_65%_55%)]")).toBe(
        true
      ) // THIRD only
    })

    it("calls the matching entity's record-review mutation with {id, line} when a 'Mark reviewed by' item is clicked", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockRecordRiskLineReview.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, data: [] }),
      })

      renderPage()

      // LEAD_AUDITOR + risk row: exactly one recordable line (THIRD), no
      // "Move to" items to disambiguate from -- an unambiguous single menu
      // item to click.
      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem")
      await userEvent.click(menuItem)

      // Review round 1: recording a review is now confirmed the same way
      // reassignment is (see confirmRequest's own comment) -- the menu
      // click opens the dialog, the mutation only fires once confirmed.
      const confirmButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReviewConfirm",
      })
      await userEvent.click(confirmButton)

      await waitFor(() =>
        expect(mockRecordRiskLineReview).toHaveBeenCalledWith({
          id: "risk-1",
          line: "THIRD",
        })
      )
    })

    it("calls recordFindingLineReview for an Action's record-review item", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockRecordFindingLineReview.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, data: [] }),
      })

      renderPage()

      // Action reassignment is ADMIN-or-LEAD_AUDITOR, so a LEAD_AUDITOR's
      // menu here mixes "Move to" items with the single THIRD record-review
      // item -- click the record-review item specifically (last menuitem).
      const actionRow = rowFor("Patch critical vulnerability")
      await userEvent.click(
        within(actionRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItems = await screen.findAllByRole("menuitem")
      await userEvent.click(menuItems[menuItems.length - 1])

      const confirmButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReviewConfirm",
      })
      await userEvent.click(confirmButton)

      await waitFor(() =>
        expect(mockRecordFindingLineReview).toHaveBeenCalledWith({
          id: "action-1",
          line: "THIRD",
        })
      )
    })

    it("excludes a line that already has a live review from the recordable options", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "THIRD", reviewedById: "u1", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      // No recordable lines left (THIRD is the only one LEAD_AUDITOR may
      // record, and it's already reviewed) and reassignment requires ADMIN
      // -- so the trigger shouldn't render at all for this row.
      expect(
        within(riskRow).queryByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      ).not.toBeInTheDocument()
    })

    it("shows one colored review dot per line with a live review", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "SECOND", reviewedById: "u1", reviewedAt: "2026-01-01" },
                { line: "THIRD", reviewedById: "u2", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      const dots = within(riskRow).getAllByTitle(
        "organization.threeLinesOfDefense.reviewedByLine"
      )
      expect(dots).toHaveLength(2)
      expect(
        dots.some((d) => d.classList.contains("bg-[hsl(250_70%_50%)]"))
      ).toBe(true) // SECOND
      expect(
        dots.some((d) => d.classList.contains("bg-[hsl(320_65%_38%)]"))
      ).toBe(true) // THIRD
    })

    // Review round 2 (UX): a review by the SAME line that owns the item
    // isn't independent assurance -- the Coverage Overview's own copy says
    // only 2nd/3rd-line review counts. Self-review now renders outlined
    // (border + colored text, no solid fill), distinct from an
    // independent review's solid fill, with a distinguishing aria-label.
    it("renders a self-review (same line as ownership) outlined, distinct from an independent review", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "FIRST",
              line_reviews: [
                { line: "FIRST", reviewedById: "u1", reviewedAt: "2026-01-01" },
                { line: "SECOND", reviewedById: "u2", reviewedAt: "2026-01-01" },
              ],
            },
          ],
        }),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      const selfBadge = within(riskRow).getByTitle(
        "organization.threeLinesOfDefense.reviewedByLineSelf"
      )
      const independentBadge = within(riskRow).getByTitle(
        "organization.threeLinesOfDefense.reviewedByLine"
      )
      // Self-review: outlined (line-colored border, app-text-colored
      // glyph -- see LINE_BORDER's own comment for why the glyph isn't
      // the line's own hue), no solid bg-* fill class.
      expect(selfBadge.classList.contains("border-chart-1")).toBe(true)
      expect(selfBadge.classList.contains("text-foreground")).toBe(true)
      expect(
        Array.from(selfBadge.classList).some((c) => c.startsWith("bg-["))
      ).toBe(false)
      // Independent review: solid fill, no outline.
      expect(independentBadge.classList.contains("bg-[hsl(250_70%_50%)]")).toBe(
        true
      )
      expect(independentBadge.classList.contains("border-current")).toBe(false)
    })

    it("renders no review dots for an item with an empty line_reviews array", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      expect(
        within(riskRow).queryAllByTitle(
          "organization.threeLinesOfDefense.reviewedByLine"
        )
      ).toHaveLength(0)
    })

    it("shows a success toast when a review is recorded successfully", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockRecordRiskLineReview.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, data: [] }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem")
      await userEvent.click(menuItem)

      const confirmButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReviewConfirm",
      })
      await userEvent.click(confirmButton)

      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "organization.threeLinesOfDefense.toast.reviewRecorded"
        )
      )
    })

    it("shows an error toast when recording a review fails", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockRecordRiskLineReview.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "Only LEAD_AUDITOR can record a 3rd Line review" } }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem")
      await userEvent.click(menuItem)

      const confirmButton = await screen.findByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReviewConfirm",
      })
      await userEvent.click(confirmButton)

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          "Only LEAD_AUDITOR can record a 3rd Line review"
        )
      )
    })

    // Review round 1 (UX): recording a review is at least as governance-
    // significant as reassignment -- it's a permanent-feeling attestation
    // with no visible undo in the UI -- so it now gets the SAME
    // confirm-before-fire treatment as "Move to", not none.
    it("fires a confirmation dialog before recording a review, same as reassignment", async () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockRecordRiskLineReview.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, data: [] }),
      })

      renderPage()

      const riskRow = rowFor("Supply chain disruption")
      await userEvent.click(
        within(riskRow).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        })
      )
      const menuItem = await screen.findByRole("menuitem")
      await userEvent.click(menuItem)

      // The mutation must NOT fire until the dialog is confirmed.
      expect(
        await screen.findByText(
          "organization.threeLinesOfDefense.confirmReviewTitle"
        )
      ).toBeInTheDocument()
      expect(mockRecordRiskLineReview).not.toHaveBeenCalled()

      const confirmButton = screen.getByRole("button", {
        name: "organization.threeLinesOfDefense.confirmReviewConfirm",
      })
      await userEvent.click(confirmButton)

      await waitFor(() => expect(mockRecordRiskLineReview).toHaveBeenCalled())
    })
  })

  // Regression: risk.category/status, action.priority/status, kri.status,
  // obligation.domain/status and engagement.status used to be interpolated
  // directly into the meta line with no label mapping, rendering raw
  // backend enum values like "cyber · open" or "data_protection ·
  // non_compliant" instead of humanized labels.
  it("shows humanized labels in the meta line, not raw backend enum/domain values", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData({
        risks: [
          {
            id: "risk-1",
            title: "Supply chain disruption",
            category: "cyber",
            status: "open",
            line_of_defense: "FIRST",
            line_reviews: [],
          },
        ],
        actions: [
          {
            id: "action-1",
            title: "Patch critical vulnerability",
            priority: "High",
            status: "TO_DO",
            line_of_defense: "SECOND",
            line_reviews: [],
          },
          {
            id: "action-unclassified",
            title: "Legacy remediation item",
            priority: "High",
            status: "TO_DO",
            line_of_defense: null,
            line_reviews: [],
          },
        ],
        kris: [
          {
            id: "kri-1",
            title: "Supplier Lead Time",
            unit: "days",
            status: "OK",
            line_of_defense: "SECOND",
            line_reviews: [],
          },
        ],
        complianceObligations: [
          {
            id: "compliance-1",
            title: "GDPR data mapping",
            domain: "data_protection",
            status: "non_compliant",
            line_of_defense: "SECOND",
            line_reviews: [],
          },
        ],
        auditEngagements: [
          {
            id: "audit-1",
            title: "Q3 internal audit",
            status: "planned",
            lead_auditor: "Jane Doe",
            line_of_defense: "THIRD",
            line_reviews: [],
          },
        ],
      }),
      isLoading: false,
    })

    renderPage()

    // Integration-axis fix (quality-bar-loop): category/priority/unit/
    // domain/lead-auditor and status are now two separate pills, not one
    // combined "X · Y" string -- see MetaPill's own comment for why.
    expect(screen.getByText("Cyber")).toBeInTheDocument()
    expect(screen.getByText("Open")).toBeInTheDocument()
    // Classified (2nd Line) and Unclassified Actions sections render through
    // two separate ItemRow call sites in the source -- both must be fixed.
    expect(screen.getAllByText("High").length).toBe(2)
    expect(screen.getAllByText("To Do").length).toBe(2)
    expect(screen.getByText("days")).toBeInTheDocument()
    expect(screen.getByText("OK")).toBeInTheDocument()
    expect(screen.getByText("Data Protection")).toBeInTheDocument()
    expect(screen.getByText("Non-Compliant")).toBeInTheDocument()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByText("Planned")).toBeInTheDocument()

    // None of the raw backend values should leak through unhumanized.
    expect(screen.queryByText(/^cyber$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^open$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/TO_DO/)).not.toBeInTheDocument()
    expect(screen.queryByText(/non_compliant/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^data_protection$/)).not.toBeInTheDocument()
  })

  // aexa-frontend#939 (visual polish loop, round-2 finding): two
  // independent judges flagged this row's meta line as plain gray text
  // while Risk Register renders the same class of semantic data as a
  // colored pill -- fixed by reusing severityBadgeClasses (the same
  // shared utility Risk Register's own severity badges use) instead of
  // a flat text-muted-foreground class.
  it("renders each row's status as a severity-colored pill, not plain gray text", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData(),
      isLoading: false,
    })

    renderPage()

    // risk-1 (default makeData): status "open" -> RISK_STATUS_SEVERITY.open
    // = "medium" -> severityBadgeClasses("medium") includes the amber
    // background/text pair, not a flat muted-foreground gray. Category and
    // status are separate pills now (integration-axis fix, quality-bar-loop)
    // -- this test only covers the status half; the category half's own
    // color is covered by the "category color matches" test below.
    const status = screen.getByText("Open")
    expect(status.className).not.toContain("text-muted-foreground")
    expect(status.className).toContain("rounded-full")
    expect(status.className).toMatch(/amber/)
  })

  // Integration-axis fix (quality-bar-loop): a risk's category used to be
  // colored by that row's STATUS severity, not by the category itself --
  // so the same category ("Cyber") could render in a different color on
  // every row depending on its status, and never matched RiskDetails.tsx's
  // own dedicated per-category color (RISK_CATEGORIES). Now uses the same
  // color source RiskDetails.tsx does.
  it("colors a risk's category pill with its own dedicated color, matching RiskDetails/RiskRegister", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData({
        risks: [
          {
            id: "risk-1",
            title: "Supply chain disruption",
            category: "cyber",
            status: "closed",
            line_of_defense: "FIRST",
            line_reviews: [],
          },
        ],
      }),
      isLoading: false,
    })

    renderPage()

    const category = screen.getByText("Cyber")
    // RISK_CATEGORIES.cyber.color from riskConfig.ts (hsl(199, 89%, 48%),
    // normalized to rgb by jsdom's computed style) -- must be the actual
    // category color, not the status-driven severityBadgeClasses output
    // (this test's risk status is "closed", which maps to the "neutral"
    // severity; if the category pill were still status-colored, it would
    // carry a text-muted-foreground-style neutral class instead).
    expect(category.style.color).toBe("rgb(13, 162, 231)")
  })

  // aexa-frontend round-4 audit bug #334: a failed query used to render
  // identically to a genuinely empty board -- no isError/error handling.
  it("shows an error state with a retry button when the query fails, and refetches on click", async () => {
    const mockRefetch = vi.fn()
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    })

    renderPage()

    expect(
      screen.getByText("organization.threeLinesOfDefense.loadFailed")
    ).toBeInTheDocument()
    // The genuinely-empty-board copy must not also render.
    expect(
      screen.queryByText("organization.threeLinesOfDefense.empty")
    ).not.toBeInTheDocument()
    await waitFor(() => expect(mockToastError).toHaveBeenCalled())

    const retryButton = screen.getByRole("button", {
      name: "organization.threeLinesOfDefense.retry",
    })
    // quality-bar-loop round 2 (mobile, round-1 finding): measured
    // under the 44px touch-target guideline.
    expect(retryButton.className).toContain("h-11")

    await userEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalled()
  })

  // quality-bar-loop round 8 (resilience, round-7 finding): the retry
  // button used to give no visual feedback while a retry was in flight
  // (only isLoading/isError were branched on, never isFetching), so a
  // slow/hung retry looked like a no-op inviting repeated clicks.
  it("disables the retry button and shows retrying feedback while a retry is in flight", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: true,
      isError: true,
      refetch: vi.fn(),
    })

    renderPage()

    const retryButton = screen.getByRole("button", {
      name: "organization.threeLinesOfDefense.retrying",
    })
    expect(retryButton).toBeDisabled()
  })

  it("shows empty-state text for a line with no items", () => {
    mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
      data: makeData({ risks: [], kris: [], complianceObligations: [] }),
      isLoading: false,
    })

    renderPage()

    // FIRST line now has no risks -- empty label should appear at least once.
    expect(
      screen.getAllByText("organization.threeLinesOfDefense.empty").length
    ).toBeGreaterThan(0)
  })

  // aexa-frontend#930: CEO feedback ("still a bit cluttered, remove the
  // superfluous text") -- live-verified before this change, a line with
  // items in only 1-2 of the 5 entity-type sections still rendered a full
  // header + "No items in this line yet" for every OTHER section, e.g. up
  // to 3-4 near-identical empty sentences stacked in a single column.
  //
  // aexa-frontend#939 (visual polish loop, round-1 finding): a fresh CEO
  // "still cluttered" complaint after #930 traced to the STRUCTURAL cause
  // #930 didn't touch -- every line still rendered up to 5 separate
  // per-entity-type headers (icon+label+count) even once the empty ones
  // were hidden, so a line with real items in just 1-2 types still showed
  // 1-2 near-identical headers for essentially no content. The 5 sections
  // are now merged into one flat, unheaded list per line -- these tests
  // now assert that no per-type headers render at all within a line card,
  // and that the single empty message still only appears when the whole
  // line is genuinely empty.
  describe("flat per-line item list, no per-type section headers (#930, #939)", () => {
    function cardForLine(lineHeadingText: string): HTMLElement {
      const heading = screen.getByRole("heading", {
        level: 2,
        name: lineHeadingText,
      })
      const card = heading.closest('[data-slot="card"]')
      if (!card) {
        throw new Error(`No card found for heading "${lineHeadingText}"`)
      }
      return card as HTMLElement
    }

    it("does not render any per-entity-type section header within a populated line's card", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Default makeData: FIRST line only has a risk -- no per-type
      // headers (risks/actions/kris/compliance/audits) should render at
      // all, only the item itself.
      const firstCard = cardForLine(
        "organization.threeLinesOfDefense.lines.first"
      )
      expect(
        within(firstCard).queryByText(
          "organization.threeLinesOfDefense.empty"
        )
      ).not.toBeInTheDocument()
      for (const sectionKey of [
        "risks",
        "actions",
        "kris",
        "compliance",
        "audits",
      ]) {
        expect(
          within(firstCard).queryByText(
            `organization.threeLinesOfDefense.sections.${sectionKey}`
          )
        ).not.toBeInTheDocument()
      }
      expect(
        within(firstCard).getByText("Supply chain disruption")
      ).toBeInTheDocument()
    })

    it("renders multiple entity types in one flat list per line with no headers between them", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Default makeData: SECOND line has an action, a kri, and a
      // compliance obligation -- all 3 must render in the same card with
      // no section header separating them.
      const secondCard = cardForLine(
        "organization.threeLinesOfDefense.lines.second"
      )
      expect(
        within(secondCard).getByText("Patch critical vulnerability")
      ).toBeInTheDocument()
      expect(
        within(secondCard).getByText("Supplier Lead Time")
      ).toBeInTheDocument()
      expect(
        within(secondCard).getByText("GDPR data mapping")
      ).toBeInTheDocument()
      // Integration-axis fix (quality-bar-loop): a line mixing >=2 entity
      // types now shows a filter-chip row using these same section labels
      // (restores the filtering PR #940 removed) -- so the label CAN
      // appear once, as a chip. What must never come back is the old
      // per-item stacked <h3> header repeated between rows; assert on the
      // tag, not the text's mere presence.
      for (const sectionKey of [
        "risks",
        "actions",
        "kris",
        "compliance",
        "audits",
      ]) {
        const label = `organization.threeLinesOfDefense.sections.${sectionKey}`
        for (const match of within(secondCard).queryAllByText(label)) {
          expect(match.closest("h3")).toBeNull()
        }
      }
    })

    it("shows exactly one empty message for a line where every entity type is empty", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Default makeData never assigns anything to GOVERNING_BODY -- it
      // must show the empty message exactly once for the whole card.
      const governingBodyCard = cardForLine(
        "organization.threeLinesOfDefense.lines.governingBody"
      )
      expect(
        within(governingBodyCard).getAllByText(
          "organization.threeLinesOfDefense.empty"
        )
      ).toHaveLength(1)
      expect(
        within(governingBodyCard).queryByText(
          "organization.threeLinesOfDefense.sections.risks"
        )
      ).not.toBeInTheDocument()
    })

    // Integration-axis fix (quality-bar-loop): PR #940 removed the only
    // way to filter or isolate one entity type within a line when it
    // removed the 5 stacked Section headers. These tests cover the
    // restored filter chips directly.
    it("does not show filter chips for a line with only one entity type present", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Default makeData: FIRST line only has a risk -- a single-type
      // line gets no redundant "All / Risks" toggle.
      const firstCard = cardForLine(
        "organization.threeLinesOfDefense.lines.first"
      )
      expect(
        within(firstCard).queryByRole("group", {
          name: "organization.threeLinesOfDefense.filterLabel",
        })
      ).not.toBeInTheDocument()
    })

    it("shows a filter chip per entity type present for a mixed line, and filters the list on click", async () => {
      const user = userEvent.setup()
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // Default makeData: SECOND line has an action, a kri, and a
      // compliance obligation -- 3 types present.
      const secondCard = cardForLine(
        "organization.threeLinesOfDefense.lines.second"
      )
      const filterGroup = within(secondCard).getByRole("group", {
        name: "organization.threeLinesOfDefense.filterLabel",
      })
      expect(
        within(filterGroup).getByRole("button", {
          name: /organization\.threeLinesOfDefense\.filterAll/,
        })
      ).toBeInTheDocument()
      expect(
        within(filterGroup).getByRole("button", {
          name: /organization\.threeLinesOfDefense\.sections\.kris/,
        })
      ).toBeInTheDocument()

      // All three items visible by default (filter = "all").
      expect(
        within(secondCard).getByText("Patch critical vulnerability")
      ).toBeInTheDocument()
      expect(
        within(secondCard).getByText("Supplier Lead Time")
      ).toBeInTheDocument()
      expect(
        within(secondCard).getByText("GDPR data mapping")
      ).toBeInTheDocument()

      await user.click(
        within(filterGroup).getByRole("button", {
          name: /organization\.threeLinesOfDefense\.sections\.kris/,
        })
      )

      // Only the KRI remains; the action and compliance rows are filtered
      // out (not just visually hidden -- actually absent from the DOM).
      expect(
        within(secondCard).getByText("Supplier Lead Time")
      ).toBeInTheDocument()
      expect(
        within(secondCard).queryByText("Patch critical vulnerability")
      ).not.toBeInTheDocument()
      expect(
        within(secondCard).queryByText("GDPR data mapping")
      ).not.toBeInTheDocument()
    })

    it("only ever offers a chip for a type actually present in that line (never a zero-count chip)", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // SECOND line's entity types are action/kri/compliance only (default
      // makeData) -- risk and audit chips must not exist for this line,
      // since a chip for a type with 0 items would be dead UI.
      const secondCard = cardForLine(
        "organization.threeLinesOfDefense.lines.second"
      )
      const filterGroup = within(secondCard).getByRole("group", {
        name: "organization.threeLinesOfDefense.filterLabel",
      })
      expect(
        within(filterGroup).queryByRole("button", {
          name: /organization\.threeLinesOfDefense\.sections\.risks/,
        })
      ).not.toBeInTheDocument()
      expect(
        within(filterGroup).queryByRole("button", {
          name: /organization\.threeLinesOfDefense\.sections\.audits/,
        })
      ).not.toBeInTheDocument()
    })

    it("returns to showing every type when the 'All' chip is clicked again after filtering", async () => {
      const user = userEvent.setup()
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const secondCard = cardForLine(
        "organization.threeLinesOfDefense.lines.second"
      )
      const filterGroup = within(secondCard).getByRole("group", {
        name: "organization.threeLinesOfDefense.filterLabel",
      })

      await user.click(
        within(filterGroup).getByRole("button", {
          name: /organization\.threeLinesOfDefense\.sections\.kris/,
        })
      )
      expect(
        within(secondCard).queryByText("Patch critical vulnerability")
      ).not.toBeInTheDocument()

      await user.click(
        within(filterGroup).getByRole("button", {
          name: /organization\.threeLinesOfDefense\.filterAll/,
        })
      )
      expect(
        within(secondCard).getByText("Patch critical vulnerability")
      ).toBeInTheDocument()
      expect(
        within(secondCard).getByText("Supplier Lead Time")
      ).toBeInTheDocument()
      expect(
        within(secondCard).getByText("GDPR data mapping")
      ).toBeInTheDocument()
    })

    // Review round 1 on PR #957: filtering to a type, then having that
    // type's last item reassigned away (via the existing move-to-another-
    // line flow) while the filter is still active, used to leave the list
    // stuck empty with no chip left to click back to "all" once
    // presentTypes no longer included the selected type.
    it("falls back to showing all items if the filtered type's last item disappears from the line", async () => {
      const user = userEvent.setup()
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      const { rerender } = renderPage()

      const secondCard = cardForLine(
        "organization.threeLinesOfDefense.lines.second"
      )
      const filterGroup = within(secondCard).getByRole("group", {
        name: "organization.threeLinesOfDefense.filterLabel",
      })
      await user.click(
        within(filterGroup).getByRole("button", {
          name: /organization\.threeLinesOfDefense\.sections\.kris/,
        })
      )
      expect(
        within(secondCard).getByText("Supplier Lead Time")
      ).toBeInTheDocument()
      expect(
        within(secondCard).queryByText("Patch critical vulnerability")
      ).not.toBeInTheDocument()

      // Simulate the KRI having moved to a different line: SECOND now has
      // only the action, no KRI, no compliance obligation (default
      // makeData's SECOND line has all 3) -- same instance still mounted
      // (that's what carries the stale `filter="kri"` state across this
      // update).
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          actions: [
            {
              id: "action-1",
              title: "Patch critical vulnerability",
              priority: "High",
              status: "TO_DO",
              line_of_defense: "SECOND",
              line_reviews: [],
            },
          ],
          kris: [],
          complianceObligations: [],
        }),
        isLoading: false,
      })
      rerender(
        <MemoryRouter>
          <ThreeLinesOfDefensePage />
        </MemoryRouter>
      )

      const secondCardAfter = cardForLine(
        "organization.threeLinesOfDefense.lines.second"
      )
      // No longer 2+ types present, so the whole filter row (including the
      // stale "KRIs" chip) is gone -- but the fallback must still show the
      // one remaining item, not an empty list.
      expect(
        within(secondCardAfter).getByText("Patch critical vulnerability")
      ).toBeInTheDocument()
      expect(
        within(secondCardAfter).queryByRole("group", {
          name: "organization.threeLinesOfDefense.filterLabel",
        })
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#532: item titles now link into their entity's detail page
  // where one exists (Risk, Action, KRI-dashboard-highlight, Audit list).
  // aexa-frontend#561: Compliance also links now -- like Audit, it has no
  // per-obligation route or ?search= support of its own, so it links to
  // the list rather than nothing (the only section previously without a
  // linkTo at all).
  describe("navigation into entity detail pages (#532, #561)", () => {
    it("links Risk, Action, KRI, Compliance, and Audit titles to their real destinations", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByRole("link", { name: "Supply chain disruption" })
      ).toHaveAttribute("href", "/organization/risks/risk-1")
      expect(
        screen.getByRole("link", { name: "Patch critical vulnerability" })
      ).toHaveAttribute("href", "/organization/finding/action-1")
      expect(
        screen.getByRole("link", { name: "Supplier Lead Time" })
      ).toHaveAttribute("href", "/organization/kri?highlight=kri-1")
      expect(
        screen.getByRole("link", { name: "GDPR data mapping" })
      ).toHaveAttribute("href", "/organization/compliance")
      expect(
        screen.getByRole("link", { name: "Q3 internal audit" })
      ).toHaveAttribute("href", "/organization/audit")
    })

    it("links an unclassified Action's title the same as a classified one", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByRole("link", { name: "Legacy remediation item" })
      ).toHaveAttribute("href", "/organization/finding/action-unclassified")
    })
  })

  // quality-bar-loop round 3 (efficiency, round-1 finding): grouping by line
  // is now computed once via useMemo/groupByLine instead of 20 inline
  // .filter() calls per render. Negative-control convention for
  // memoization fixes (established earlier this session on
  // KriDashboardPage round 3): (a) an unrelated re-render must not
  // corrupt/change correct values, and (b) a genuinely new data set via
  // rerender() must still update the values -- catching a frozen/wrong
  // dependency array, the more dangerous failure mode of a memoization
  // refactor.
  describe("memoized line grouping (round 3)", () => {
    // Finds the outer Card for a given line's own heading text, so a test
    // can assert which line-column an item currently renders under (every
    // line's Section shares the same "Risks"/"Actions"/etc. labels, so the
    // line heading is the only unique anchor per column).
    function cardForLine(lineHeadingText: string): HTMLElement {
      // Line names also appear as plain text in the round-6 coverage
      // overview's legend, so this must match only the column's own
      // <h2> heading, not any occurrence of the text.
      const heading = screen.getByRole("heading", {
        level: 2,
        name: lineHeadingText,
      })
      const card = heading.closest('[data-slot="card"]')
      if (!card) {
        throw new Error(`No card found for heading "${lineHeadingText}"`)
      }
      return card as HTMLElement
    }

    it("keeps an unrelated item in its correct line column across a re-render triggered by reassigning a different item", async () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })
      mockUpdateKri.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      const { rerender } = renderPage()

      // Reassigning the KRI (a different entity) triggers a pendingId state
      // change and a page re-render, but the underlying `data` reference is
      // unchanged -- a stale/wrong useMemo dependency could cause the
      // unrelated risk to disappear from or duplicate across columns.
      const kriRow = screen.getByText("Supplier Lead Time").closest(".rounded-md")
      if (!kriRow) throw new Error("KRI row not found")
      await moveViaDropdown(
        within(kriRow as HTMLElement).getByRole("button", {
          name: "organization.threeLinesOfDefense.moveItem",
        }),
        "organization.threeLinesOfDefense.moveToFirst"
      )
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())

      expect(
        within(
          cardForLine("organization.threeLinesOfDefense.lines.first")
        ).getByText("Supply chain disruption")
      ).toBeInTheDocument()
      expect(
        within(
          cardForLine("organization.threeLinesOfDefense.lines.second")
        ).queryByText("Supply chain disruption")
      ).not.toBeInTheDocument()

      rerender(
        <MemoryRouter>
          <ThreeLinesOfDefensePage />
        </MemoryRouter>
      )

      expect(
        within(
          cardForLine("organization.threeLinesOfDefense.lines.first")
        ).getByText("Supply chain disruption")
      ).toBeInTheDocument()
    })

    it("moves an item to its new column when the underlying data actually changes", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      const { rerender } = renderPage()

      expect(
        within(
          cardForLine("organization.threeLinesOfDefense.lines.first")
        ).getByText("Supply chain disruption")
      ).toBeInTheDocument()

      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({
          risks: [
            {
              id: "risk-1",
              title: "Supply chain disruption",
              category: "supply_chain",
              status: "open",
              line_of_defense: "THIRD",
              line_reviews: [],
            },
          ],
        }),
        isLoading: false,
      })
      rerender(
        <MemoryRouter>
          <ThreeLinesOfDefensePage />
        </MemoryRouter>
      )

      expect(
        within(
          cardForLine("organization.threeLinesOfDefense.lines.first")
        ).queryByText("Supply chain disruption")
      ).not.toBeInTheDocument()
      expect(
        within(
          cardForLine("organization.threeLinesOfDefense.lines.third")
        ).getByText("Supply chain disruption")
      ).toBeInTheDocument()
    })
  })
})
