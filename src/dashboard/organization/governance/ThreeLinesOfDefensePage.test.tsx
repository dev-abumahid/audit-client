import { render, screen, waitFor, within } from "@testing-library/react"
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

async function moveViaDropdown(trigger: HTMLElement, destinationKey: string) {
  await userEvent.click(trigger)
  const menuItem = await screen.findByRole("menuitem", {
    name: destinationKey,
  })
  await userEvent.click(menuItem)
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
vi.mock("@/redux/apis/organization/risk.api", () => ({
  useUpdateRiskMutation: () => [mockUpdateRisk, { isLoading: false }],
}))

const mockUpdateFindingById = vi.fn()
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useUpdateFindingByIdMutation: () => [mockUpdateFindingById, { isLoading: false }],
}))

const mockUpdateKri = vi.fn()
vi.mock("@/redux/apis/organization/kri.api", () => ({
  useUpdateKriMutation: () => [mockUpdateKri, { isLoading: false }],
}))

const mockUpdateCompliance = vi.fn()
vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useUpdateComplianceMutation: () => [mockUpdateCompliance, { isLoading: false }],
}))

const mockUpdateAuditEngagement = vi.fn()
vi.mock("@/redux/apis/organization/audit.api", () => ({
  useUpdateAuditEngagementMutation: () => [
    mockUpdateAuditEngagement,
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
        },
      ],
      actions: [
        {
          id: "action-1",
          title: "Patch critical vulnerability",
          priority: "High",
          status: "TO_DO",
          line_of_defense: "SECOND",
        },
        {
          id: "action-unclassified",
          title: "Legacy remediation item",
          priority: "Low",
          status: "IN_PROGRESS",
          line_of_defense: null,
        },
      ],
      kris: [
        {
          id: "kri-1",
          title: "Supplier Lead Time",
          unit: "days",
          status: "OK",
          line_of_defense: "SECOND",
        },
      ],
      complianceObligations: [
        {
          id: "compliance-1",
          title: "GDPR data mapping",
          domain: "data_protection",
          status: "compliant",
          line_of_defense: "SECOND",
        },
      ],
      auditEngagements: [
        {
          id: "audit-1",
          title: "Q3 internal audit",
          status: "planned",
          lead_auditor: "Jane Doe",
          line_of_defense: "THIRD",
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

  // quality-bar-loop round 6 (industry-standards, round-1 finding): the
  // IIA Three Lines Model's central diagnostic question -- "is 3rd line
  // reviewing enough of what 1st/2nd line own" -- was previously only
  // answerable by manually counting raw per-column totals. A coverage
  // overview panel now surfaces the actual per-line distribution per
  // entity type at a glance.
  describe("coverage overview (round 6)", () => {
    // The "Risks"/"Actions"/etc. section labels and the line names both
    // also appear inside the per-line column cards, so every assertion
    // here is scoped to the coverage panel's own Card via its unique
    // "Coverage Overview" heading.
    function coverageCard(): HTMLElement {
      return screen
        .getByText("organization.threeLinesOfDefense.coverage.title")
        .closest('[data-slot="card"]') as HTMLElement
    }

    it("renders one coverage bar segment per line with a real count, plus a legend for all 4 lines", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const card = coverageCard()

      // The Risks row has exactly 1 risk, in FIRST -- a single 100%-width
      // segment labeled with the real count via its title attribute.
      const risksLabel = within(card).getByText(
        "organization.threeLinesOfDefense.sections.risks"
      )
      const risksRow = risksLabel.parentElement as HTMLElement
      const risksBar = risksRow.querySelector('[role="img"]') as HTMLElement
      expect(risksBar).not.toBeNull()
      const segments = risksBar.querySelectorAll(":scope > div")
      expect(segments).toHaveLength(1)
      expect(segments[0]).toHaveAttribute(
        "title",
        "organization.threeLinesOfDefense.lines.first: 1"
      )
      expect((segments[0] as HTMLElement).style.width).toBe("100%")

      // The legend lists all 4 lines, not just the ones with data.
      expect(
        within(card).getByText("organization.threeLinesOfDefense.lines.first")
      ).toBeInTheDocument()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.lines.second"
        )
      ).toBeInTheDocument()
      expect(
        within(card).getByText("organization.threeLinesOfDefense.lines.third")
      ).toBeInTheDocument()
      expect(
        within(card).getByText(
          "organization.threeLinesOfDefense.lines.governingBody"
        )
      ).toBeInTheDocument()
    })

    it("surfaces the unclassified-actions count separately from the classified total", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      // 1 classified action (action-1, SECOND) + 1 unclassified
      // (action-unclassified, null) -- the coverage bar's percentages
      // should reflect only the classified item, with the unclassified
      // one called out separately rather than silently diluting the bar.
      const actionsLabel = within(coverageCard()).getByText(
        "organization.threeLinesOfDefense.sections.actions"
      )
      const actionsRow = actionsLabel.parentElement as HTMLElement
      expect(actionsRow).toHaveTextContent("1 (+1)")
    })

    it("shows a 'no items' message instead of an empty bar for a line with no data at all", () => {
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData({ auditEngagements: [] }),
        isLoading: false,
      })

      renderPage()

      const auditsLabel = within(coverageCard()).getByText(
        "organization.threeLinesOfDefense.sections.audits"
      )
      const auditsRow = auditsLabel.parentElement as HTMLElement
      expect(auditsRow).toHaveTextContent(
        "organization.threeLinesOfDefense.coverage.none"
      )
      expect(auditsRow.querySelector('[role="img"]')).toBeNull()
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

    const menuItems = await screen.findAllByRole("menuitem")
    const labels = menuItems.map((item) => item.textContent)
    expect(labels).toEqual([
      "organization.threeLinesOfDefense.moveToFirst",
      "organization.threeLinesOfDefense.moveToSecond",
      "organization.threeLinesOfDefense.moveToThird",
      "organization.threeLinesOfDefense.moveToGoverningBody",
    ])
    // Distinct labels, not 4 copies of the same string.
    expect(new Set(labels).size).toBe(labels.length)
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

    it("LEAD_AUDITOR cannot reassign Risk/Kri/Compliance (management line requires ADMIN specifically)", () => {
      mockRole = "LEAD_AUDITOR"
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
      expect(riskRow.querySelector("button")).not.toBeInTheDocument()
      expect(kriRow.querySelector("button")).not.toBeInTheDocument()
      expect(complianceRow.querySelector("button")).not.toBeInTheDocument()
    })

    it("LEAD_AUDITOR CAN reassign an AuditEngagement (audit line)", () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const auditRow = screen.getByText("Q3 internal audit").closest("div")!
        .parentElement!
        .parentElement!
      expect(auditRow.querySelector("button")).toBeInTheDocument()
    })

    it("ADMIN cannot reassign an AuditEngagement (audit line requires LEAD_AUDITOR specifically)", () => {
      mockRole = "ADMIN"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      const auditRow = screen.getByText("Q3 internal audit").closest("div")!
        .parentElement!
        .parentElement!
      expect(auditRow.querySelector("button")).not.toBeInTheDocument()
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

    it("does not attempt updateCompliance when a LEAD_AUDITOR has no button to click (server 403 avoided client-side)", () => {
      mockRole = "LEAD_AUDITOR"
      mockUseGetThreeLinesOfDefenseQuery.mockReturnValue({
        data: makeData(),
        isLoading: false,
      })

      renderPage()

      expect(mockUpdateCompliance).not.toHaveBeenCalled()
      const complianceRow = screen.getByText("GDPR data mapping").closest("div")!
        .parentElement!
        .parentElement!
      expect(complianceRow.querySelector("button")).toBeNull()
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
          },
        ],
        actions: [
          {
            id: "action-1",
            title: "Patch critical vulnerability",
            priority: "High",
            status: "TO_DO",
            line_of_defense: "SECOND",
          },
          {
            id: "action-unclassified",
            title: "Legacy remediation item",
            priority: "High",
            status: "TO_DO",
            line_of_defense: null,
          },
        ],
        kris: [
          {
            id: "kri-1",
            title: "Supplier Lead Time",
            unit: "days",
            status: "OK",
            line_of_defense: "SECOND",
          },
        ],
        complianceObligations: [
          {
            id: "compliance-1",
            title: "GDPR data mapping",
            domain: "data_protection",
            status: "non_compliant",
            line_of_defense: "SECOND",
          },
        ],
        auditEngagements: [
          {
            id: "audit-1",
            title: "Q3 internal audit",
            status: "planned",
            lead_auditor: "Jane Doe",
            line_of_defense: "THIRD",
          },
        ],
      }),
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("Cyber · Open")).toBeInTheDocument()
    // Classified (2nd Line) and Unclassified Actions sections render through
    // two separate ItemRow call sites in the source -- both must be fixed.
    expect(screen.getAllByText("High · To Do").length).toBe(2)
    expect(screen.getByText("days · OK")).toBeInTheDocument()
    expect(screen.getByText("Data Protection · Non-Compliant")).toBeInTheDocument()
    expect(screen.getByText("Jane Doe · Planned")).toBeInTheDocument()

    // None of the raw backend values should leak through unhumanized.
    expect(screen.queryByText(/cyber · open/)).not.toBeInTheDocument()
    expect(screen.queryByText(/TO_DO/)).not.toBeInTheDocument()
    expect(screen.queryByText(/non_compliant/)).not.toBeInTheDocument()
    expect(screen.queryByText(/data_protection ·/)).not.toBeInTheDocument()
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
