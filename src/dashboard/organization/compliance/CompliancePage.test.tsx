import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createContext, useContext } from "react"
import type React from "react"
import { MemoryRouter } from "react-router"
import CompliancePage from "./CompliancePage"

// aexa-server#531: the "View Action" link needs a Router context, same
// convention as InspectionTable.test.tsx's renderTable().
function renderPage() {
  return render(
    <MemoryRouter>
      <CompliancePage />
    </MemoryRouter>
  )
}

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce the "1 obligations tracked" pluralization bug (organization.
// compliance.subtitle_one/_other), since i18next's plural-suffix resolution
// only kicks in once real resources/pluralization rules are loaded.
// Overriding just this one key, with the same singular/plural behavior the
// real en.json resource now has, lets the test tell the fixed
// subtitle_one/_other split apart from the old un-pluralized "subtitle" key
// -- every other key still falls back to itself unchanged, so no existing
// assertion elsewhere in this file is affected. Same technique as
// CorrelationMatrixPage.test.tsx.
// mockLanguage feeds `i18n.language` through to the real hook's `i18n`
// object below, so the round-3 audit fix (entry.attested_at now going
// through formatLocaleDate(entry.attested_at, i18n.language) instead of
// being hardcoded to "en-US") can be exercised by the locale test further
// down -- same convention as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return {
        ...real,
        i18n: { ...real.i18n, language: mockLanguage },
        t: (key: string, opts?: Record<string, unknown>) => {
          if (key === "organization.compliance.subtitle") {
            const count = Number(opts?.count ?? 0)
            return count === 1
              ? `${count} obligation tracked`
              : `${count} obligations tracked`
          }
          return key
        },
      }
    },
  }
})

import { toast } from "sonner"
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllComplianceQuery = vi.fn()
const mockUseGetComplianceScorecardQuery = vi.fn()
const mockCreateCompliance = vi.fn()
const mockUpdateCompliance = vi.fn()
const mockDeleteCompliance = vi.fn()
const mockAttestCompliance = vi.fn()
const mockUseGetComplianceAttestationsQuery = vi.fn()
const mockUseGetComplianceEditHistoryQuery = vi.fn()

vi.mock("@/redux/apis/organization/compliance.api", () => ({
  useGetAllComplianceQuery: (...args: unknown[]) =>
    mockUseGetAllComplianceQuery(...args),
  useGetComplianceByIdQuery: () => ({ data: undefined }),
  useGetComplianceScorecardQuery: (...args: unknown[]) =>
    mockUseGetComplianceScorecardQuery(...args),
  useCreateComplianceMutation: () => [
    mockCreateCompliance,
    { isLoading: false },
  ],
  useUpdateComplianceMutation: () => [
    mockUpdateCompliance,
    { isLoading: false },
  ],
  useDeleteComplianceMutation: () => [mockDeleteCompliance],
  useAttestComplianceMutation: () => [
    mockAttestCompliance,
    { isLoading: false },
  ],
  useGetComplianceAttestationsQuery: (...args: unknown[]) =>
    mockUseGetComplianceAttestationsQuery(...args),
  useGetComplianceEditHistoryQuery: (...args: unknown[]) =>
    mockUseGetComplianceEditHistoryQuery(...args),
}))

const mockUseGetAllSitesQuery = vi.fn()
vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

// The reused Action-creation modal (#166) pulls in its own RTK Query hooks
// (findings/inspection/org-users/upload) that this suite doesn't wrap in a
// store — mock it and capture the props it's opened with, the same pattern
// AllFindingsPage.test uses.
const mockCreateActionModal = vi.fn()
// Radix DropdownMenu needs pointer-capture APIs jsdom doesn't implement, same
// reason InspectionTable.test.tsx swaps out its Select. Content is rendered
// unconditionally (no open/closed simulation) so the row actions are
// directly queryable without needing to click the trigger first.
// quality-bar-loop round 20 (accessibility, fresh-panel finding): captures
// every onCloseAutoFocus handler this mock is rendered with, so a test can
// assert ComplianceObligationRow actually passes one that prevents Radix's
// default close-focus-return -- the real Radix DropdownMenuContent isn't
// used here at all (fully mocked below), so jsdom timing can't reproduce
// the actual trigger-steals-focus-back race this fix addresses; asserting
// the handler exists and calls preventDefault is the deterministic
// substitute for that live-browser-only race.
//
// ComplianceObligationRow now defers each item's actual action (edit/
// attest/history/delete) to run INSIDE onCloseAutoFocus rather than
// directly in the item's own onClick (see that file's own comment for
// why) -- so this mock's DropdownMenuItem simulates Radix actually
// closing the menu after a click by invoking ITS OWN DropdownMenuContent
// ancestor's onCloseAutoFocus handler right after the item's onClick, the
// same sequence a real click-to-select in Radix produces. Scoped per
// DropdownMenuContent instance via context (not a single shared module
// variable) since the obligations table renders one dropdown per row --
// a shared "last one wins" variable would call the WRONG row's handler
// whenever more than one row is present.
const capturedOnCloseAutoFocusHandlers: ((e: Event) => void)[] = []
const OnCloseAutoFocusContext = createContext<((e: Event) => void) | null>(
  null
)
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({
    children,
    onCloseAutoFocus,
  }: {
    children: React.ReactNode
    onCloseAutoFocus?: (e: Event) => void
  }) => {
    if (onCloseAutoFocus) capturedOnCloseAutoFocusHandlers.push(onCloseAutoFocus)
    return (
      <OnCloseAutoFocusContext.Provider value={onCloseAutoFocus ?? null}>
        <div>{children}</div>
      </OnCloseAutoFocusContext.Provider>
    )
  },
  DropdownMenuItem: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
    variant?: string
  }) => {
    const onCloseAutoFocus = useContext(OnCloseAutoFocusContext)
    return (
      <button
        type="button"
        onClick={(e) => {
          onClick?.(e)
          onCloseAutoFocus?.({
            preventDefault: () => {},
          } as unknown as Event)
        }}
        data-variant={variant}
      >
        {children}
      </button>
    )
  },
}))

vi.mock("@/dashboard/organization/findings/CreateNewFindingModal", () => ({
  default: (props: {
    open: boolean
    additionalData?: { complianceObligationId?: string; actionTitle?: string }
  }) => {
    mockCreateActionModal(props)
    return props.open ? (
      <div data-testid="create-action-modal">
        {props.additionalData?.actionTitle}
      </div>
    ) : null
  },
}))

// The Title label isn't associated with its input via htmlFor, so locate it
// through the label's wrapping <div>. In the test env i18n is not initialized,
// so t() echoes raw keys (same convention as RiskRegisterPage.test).
function titleInput(): HTMLInputElement {
  const label = screen.getByText(/organization\.compliance\.form\.title/)
  return label.parentElement!.querySelector("input")!
}

function makeObligation(overrides = {}) {
  return {
    id: "comp-1",
    org_account_id: "org-a",
    site_id: null,
    title: "GDPR Article 30 records",
    description: "Maintain records of processing activities",
    domain: "data_protection",
    status: "in_progress",
    owner: "Jane Doe",
    due_date: "2026-12-31T00:00:00.000Z",
    attachments: [],
    ai_generated: false,
    is_edited: true,
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
    line_of_defense: "SECOND",
    regulation_reference: null,
    recurrence: null,
    next_review_date: null,
    overdue: false,
    // aexa-server#531: populated once a remediation action exists for this
    // obligation -- empty by default so existing tests keep seeing the
    // pre-#531 "Create Action" behavior unless a test opts into overriding it.
    actions: [] as { id: string; actionTitle: string; status: string }[],
    ...overrides,
  }
}

const emptyScorecard = {
  overall: { compliant: 0, total: 0, ratio: 0, band: "none" as const },
  byDomain: [],
  bySite: [],
  matrix: [],
}

describe("CompliancePage", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockRole = "ADMIN"
    mockUseGetAllComplianceQuery.mockReset()
    mockUseGetComplianceScorecardQuery.mockReset()
    mockCreateCompliance.mockReset()
    mockUpdateCompliance.mockReset()
    mockDeleteCompliance.mockReset()
    mockAttestCompliance.mockReset()
    mockUseGetComplianceAttestationsQuery.mockReset()
    mockUseGetComplianceEditHistoryQuery.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockCreateActionModal.mockReset()
    // Sensible defaults; individual tests override the compliance query.
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: { data: emptyScorecard },
    })
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
    mockUseGetComplianceAttestationsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetComplianceEditHistoryQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
  })

  it("shows New Obligation, Edit, Attest and Delete for an ADMIN", () => {
    mockRole = "ADMIN"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.compliance.newObligation")
    ).toBeInTheDocument()
    // Edit/Attest/History/Delete are now inside a "more actions" dropdown
    // (round-2 audit: consolidated from always-visible icon buttons).
    expect(
      screen.getByText("organization.compliance.attest.button")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.compliance.attest.historyButton")
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): every
  // interactive control on this page measured under the 44px
  // touch-target guideline -- "New Obligation" 32px, row "more
  // actions" trigger 32x32px, modal Cancel/Save buttons 38px. Same
  // h-11/h-11-w-11 fix already shipped on 5 sibling pages this
  // session.
  it("gives the New Obligation button, row actions trigger, and form modal's Cancel/Create buttons a 44px touch target", async () => {
    const user = userEvent.setup()
    mockRole = "ADMIN"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      }).className
    ).toContain("h-11")
    expect(
      screen.getByRole("button", {
        name: "organization.compliance.moreActionsLabel",
      }).className
    ).toContain("h-11")
    // Review finding (round 2): this button sat in a tight
    // `flex items-center justify-end gap-1` row -- h-11/w-11 alone let
    // the flex layout squeeze its WIDTH below 44px at narrow table
    // widths even though the height stayed correct. shrink-0 stops the
    // row from compressing it.
    expect(
      screen.getByRole("button", {
        name: "organization.compliance.moreActionsLabel",
      }).className
    ).toContain("shrink-0")

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )
    expect(
      screen.getByRole("button", { name: "organization.compliance.form.cancel" })
        .className
    ).toContain("h-11")
    expect(
      screen.getByRole("button", { name: "organization.compliance.form.create" })
        .className
    ).toContain("h-11")
  })

  it("hides New Obligation, Edit, Attest and Delete for a VIEWER but keeps History", () => {
    mockRole = "VIEWER"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText("organization.compliance.newObligation")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.compliance.attest.button")
    ).not.toBeInTheDocument()
    // History (read-only) stays visible regardless of role.
    expect(
      screen.getByText("organization.compliance.attest.historyButton")
    ).toBeInTheDocument()
  })

  it("hides write controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByText("organization.compliance.newObligation")
    ).not.toBeInTheDocument()
  })

  it("shows a loading spinner while the query is loading", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    const { container } = renderPage()

    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.compliance.empty")
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop-derived fix: totalCount fell back to
  // obligations.length (0) whenever complianceData was undefined -- true
  // during the initial fetch -- so the header used to read "0 obligations
  // tracked" at the exact moment the table below correctly showed a
  // loading spinner. Mirrors RiskRegisterPage's identical fix
  // (aexa-frontend#618).
  it("shows the loading message in the header subtitle instead of a false zero count", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })

    renderPage()

    // both the header subtitle and the table's loading spinner render this
    // same key's text (the spinner's copy is screen-reader-only), so two
    // matches is the expected, correct outcome.
    expect(
      screen.getAllByText("organization.compliance.loading")
    ).toHaveLength(2)
    expect(screen.queryByText("0 obligations tracked")).not.toBeInTheDocument()
  })

  // quality-bar-loop-derived fix: this table had no error row at all -- a
  // fetch failure and "the filter matched zero obligations" both
  // previously rendered the exact same silent empty-state, and the header
  // subtitle also fell back to a false "0 obligations tracked".
  it("shows a distinct error row and error subtitle, not the empty state, when the query fails", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    renderPage()

    // both the header subtitle and the table's error row render this same
    // key's text, so two matches is the expected, correct outcome.
    expect(
      screen.getAllByText("organization.compliance.loadError")
    ).toHaveLength(2)
    expect(
      screen.queryByText("organization.compliance.empty")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("0 obligations tracked")).not.toBeInTheDocument()
  })

  // quality-bar-loop round (Compliance resilience, fresh-panel finding):
  // RTK Query correctly retains the last-successful `data` through a
  // failed refetch (e.g. changing the domain filter while the endpoint is
  // down) -- this used to render the stale, filter-mismatched rows AND
  // the error banner at the same time, with nothing telling the user the
  // visible rows aren't current. Live-reproduced in a real browser by
  // scoping a fetch-failure injection and switching the domain filter
  // mid-outage: the previous domain's row stayed visible next to "Failed
  // to load obligations."
  it("hides stale rows instead of showing them alongside the error banner when a refetch fails", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      // RTK Query's real shape on a failed refetch: `data` is still the
      // last-successful payload, `isError` is true.
      data: { data: [makeObligation({ title: "Stale GDPR row" })] },
      isLoading: false,
      isError: true,
    })

    renderPage()

    expect(
      screen.getAllByText("organization.compliance.loadError")
    ).toHaveLength(2)
    expect(screen.queryByText("Stale GDPR row")).not.toBeInTheDocument()
  })

  // Same discarded-isError bug as the main obligations query above
  // (aexa-frontend#625), for the separate scorecard query: a fetch failure
  // previously fell through to `scorecard` being undefined, which the
  // summary cards and site x domain matrix already treat identically to
  // "no obligations exist yet" (a genuinely empty org), with zero visual
  // distinction and, for the two count cards, a page-scoped fallback number
  // silently displayed under a "whole-org" label.
  it("shows a distinct error indicator on the scorecard section when it fails to load, instead of the empty/zero states", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation({ status: "non_compliant" })] },
      isLoading: false,
    })
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: undefined,
      isError: true,
    })

    renderPage()

    // The two summary-card counts show "--" rather than the page-scoped
    // fallback (which would otherwise silently count the one loaded row
    // under the "whole-org" label).
    expect(screen.getAllByText("—")).not.toHaveLength(0)
    expect(screen.queryByText("1")).not.toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    // Both the summary-cards banner and the matrix's own error state render
    // this same key's text.
    expect(
      screen.getAllByText("organization.compliance.scorecard.loadError")
    ).toHaveLength(2)
    expect(
      screen.queryByText("organization.compliance.scorecard.noData")
    ).not.toBeInTheDocument()
  })

  it("renders obligation rows from the query with title and domain", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("GDPR Article 30 records")).toBeInTheDocument()
    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    // Domain label is echoed as its raw i18n key in the test environment.
    expect(
      within(row).getByText("organization.compliance.domains.data_protection")
    ).toBeInTheDocument()
  })

  // Regression: "{{count}} obligations tracked" was a single un-pluralized
  // key, so it rendered "1 obligations tracked" for a single obligation.
  it("renders the singular subtitle for a single obligation", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("1 obligation tracked")).toBeInTheDocument()
    expect(screen.queryByText("1 obligations tracked")).not.toBeInTheDocument()
  })

  it("renders the plural subtitle for multiple obligations", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation(), makeObligation({ id: "comp-2" })],
        meta: { page: 1, limit: 20, total: 2, totalPage: 1 },
      },
      isLoading: false,
    })

    renderPage()

    expect(screen.getByText("2 obligations tracked")).toBeInTheDocument()
  })

  it("shows the empty state when there are no obligations", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText("organization.compliance.empty")
    ).toBeInTheDocument()
  })

  it("renders the scorecard overall percentage and a matrix cell", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation({ status: "compliant" })] },
      isLoading: false,
    })
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: {
        data: {
          overall: { compliant: 1, total: 2, ratio: 0.5, band: "red" },
          byDomain: [
            {
              domain: "data_protection",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
          bySite: [
            {
              site_id: null,
              site_name: null,
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
          matrix: [
            {
              site_id: null,
              site_name: null,
              domain: "data_protection",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
        },
      },
    })

    renderPage()

    // Overall ratio 0.5 -> 50%
    expect(screen.getByText("50%")).toBeInTheDocument()
    // Matrix cell "1/2" for the org-wide row
    expect(screen.getByText("1/2")).toBeInTheDocument()
  })

  // aexa-frontend#553: the scorecard matrix's per-site row header showed
  // the site name as plain text even though its real site id (siteKey) was
  // already available -- reuses the established ?siteId=&search= pattern
  // (#533/#541). The synthetic "__org__" bucket (tested above via
  // site_id: null) must stay unlinked since it isn't a real site.
  it("links a real site's scorecard row into Sites, scoped to that site", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "Casablanca HQ" }] },
    })
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation({ status: "compliant" })] },
      isLoading: false,
    })
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: {
        data: {
          overall: { compliant: 1, total: 2, ratio: 0.5, band: "red" },
          byDomain: [
            {
              domain: "data_protection",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
          bySite: [
            {
              site_id: "site-1",
              site_name: "Casablanca HQ",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
          matrix: [
            {
              site_id: "site-1",
              site_name: "Casablanca HQ",
              domain: "data_protection",
              compliant: 1,
              total: 2,
              ratio: 0.5,
              band: "red",
            },
          ],
        },
      },
    })

    renderPage()

    const link = screen.getByRole("link", { name: "Casablanca HQ" })
    expect(link).toHaveAttribute(
      "href",
      "/organization/sites?siteId=site-1&search=Casablanca%20HQ"
    )
  })

  it("submits the create form and calls createCompliance with filled data", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockCreateCompliance.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Obligation created" }),
    })

    renderPage()

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )
    await user.type(titleInput(), "New CCPA obligation")
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.form.create",
      })
    )

    await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
    const submitted = mockCreateCompliance.mock.calls[0][0]
    expect(submitted).toMatchObject({
      title: "New CCPA obligation",
      domain: "data_protection",
      status: "in_progress",
      site_id: null,
    })
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("pre-fills the edit form and calls updateCompliance with is_edited on save", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })
    mockUpdateCompliance.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ success: true, message: "Obligation updated" }),
    })

    renderPage()

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    // Edit is now inside the row's "more actions" dropdown.
    await user.click(
      within(row).getByText("organization.compliance.editObligation")
    )

    const input = titleInput()
    expect(input).toHaveValue("GDPR Article 30 records")

    await user.clear(input)
    await user.type(input, "GDPR Article 30 records EDITED")
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.form.update",
      })
    )

    await waitFor(() => expect(mockUpdateCompliance).toHaveBeenCalled())
    const callArg = mockUpdateCompliance.mock.calls[0][0]
    expect(callArg.id).toBe("comp-1")
    expect(callArg.data).toMatchObject({
      title: "GDPR Article 30 records EDITED",
      is_edited: true,
    })
  })

  // aexa-frontend#465 -- the form modal's icon-only close button had no
  // aria-label.
  it("labels the obligation form modal's close button", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    renderPage()

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )

    expect(
      screen.getByRole("button", {
        name: "organization.compliance.form.close",
      })
    ).toBeInTheDocument()
  })

  // aexa-frontend#465 -- the edit and delete icon-only buttons had no
  // aria-label, unlike their sibling Re-attest/History buttons in the same
  // row. Assert by accessible name (not index) so this fails if the labels
  // regress even if button order changes.
  it("labels the edit and delete row buttons for screen readers", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    expect(
      within(row).getByRole("button", {
        name: "organization.compliance.editObligation",
      })
    ).toBeInTheDocument()
    expect(
      within(row).getByRole("button", {
        name: "organization.compliance.deleteObligation",
      })
    ).toBeInTheDocument()
  })

  // Round 12 audit (aexa-frontend#500): the row action buttons only became
  // visible via group-hover:opacity-100, so a keyboard-focused button
  // remained invisible (WCAG 2.4.7 focus-visible), even though it was still
  // operable via Enter. group-focus-within:opacity-100 fixes the visibility
  // without changing operability.
  it("keeps the row actions trigger visible and reachable by keyboard, not hover-gated", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    const trigger = within(row).getByRole("button", {
      name: "organization.compliance.moreActionsLabel",
    })
    expect(trigger).toBeVisible()
    expect(trigger.className).not.toContain("opacity-0")
    trigger.focus()
    expect(trigger).toHaveFocus()
  })

  // aexa-frontend#465 -- the per-attachment remove button (icon-only) had
  // no aria-label.
  it("labels the remove-attachment button on an existing evidence attachment", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            attachments: ["https://files.example.com/evidence-1.pdf"],
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(
      within(row).getByRole("button", {
        name: "organization.compliance.editObligation",
      })
    )

    expect(
      screen.getByRole("button", {
        name: "organization.compliance.form.removeAttachment",
      })
    ).toBeInTheDocument()
  })

  it("deletes an obligation after confirmation via the delete mutation", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })
    mockDeleteCompliance.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    renderPage()

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(
      within(row).getByText("organization.compliance.deleteObligation")
    )

    await user.click(
      screen.getByRole("button", {
        name: "common.deleteAlertModal.delete",
      })
    )

    await waitFor(() =>
      expect(mockDeleteCompliance).toHaveBeenCalledWith("comp-1")
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("does not call the delete mutation when confirmation is cancelled", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })

    renderPage()

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(
      within(row).getByText("organization.compliance.deleteObligation")
    )

    await user.click(
      screen.getByRole("button", {
        name: "common.deleteAlertModal.cancel",
      })
    )

    expect(mockDeleteCompliance).not.toHaveBeenCalled()
  })

  it("shows an error toast and keeps the modal open when create fails", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockCreateCompliance.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Server unavailable" } }),
    })

    renderPage()

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )
    await user.type(titleInput(), "Obligation that fails")
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.form.create",
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // Modal stays open on failure.
    expect(
      screen.getByText("organization.compliance.form.newTitle")
    ).toBeInTheDocument()
  })

  // ---- Pagination + server-side filtering (issue #161) ----

  it("requests page 1 with server-side filter params on first render", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    renderPage()

    const firstArgs = mockUseGetAllComplianceQuery.mock.calls[0][0]
    expect(firstArgs).toMatchObject({
      page: 1,
      limit: 20,
      searchTerm: "",
      // undefined (not "") when no filter is selected, so the query key stays
      // clean and the backend doesn't receive an empty filter param.
      status: undefined,
      domain: undefined,
    })
  })

  it("does not render pagination controls when there is only one page", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByLabelText("organization.compliance.pagination.next")
    ).not.toBeInTheDocument()
  })

  it("renders pagination controls and requests the next page when clicked", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 45, totalPage: 3 },
      },
      isLoading: false,
    })

    renderPage()

    // Page buttons 1..3 are rendered.
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument()

    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )

    const lastArgs =
      mockUseGetAllComplianceQuery.mock.calls[
        mockUseGetAllComplianceQuery.mock.calls.length - 1
      ][0]
    expect(lastArgs.page).toBe(2)
  })

  // Round 15 (UX finding, fresh full-panel re-score): `search` used to be
  // passed straight into the query with no debounce -- every keystroke
  // fired an immediate refetch, unlike RiskRegisterPage/TemplatesPage/
  // SitesEntities, which already use this same debounce convention. Same
  // debounce-testing pattern as RiskRegisterPage.test.tsx's own test.
  it("debounces the search term before passing it to the query hook", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    renderPage()
    mockUseGetAllComplianceQuery.mockClear()

    await user.type(
      screen.getByPlaceholderText(
        "organization.compliance.searchPlaceholder"
      ),
      "GDPR"
    )

    // Before the 300ms debounce elapses, the query must not yet have been
    // called with the fully-typed term -- this is exactly the gap the fix
    // closes.
    expect(mockUseGetAllComplianceQuery).not.toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: "GDPR" })
    )

    vi.advanceTimersByTime(300)

    await waitFor(() =>
      expect(mockUseGetAllComplianceQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "GDPR" })
      )
    )
    vi.useRealTimers()
  })

  // aexa-frontend#265: the delete-path counterpart to #234/#243 (this file's
  // own handleSearchChange/handleDomainChange/handleStatusChange reset page
  // on a filter change, but nothing resets it when a delete alone shrinks
  // totalPages).
  it("aexa-frontend#265: clamps the page back into range after deleting the last obligation on the last page", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 45, totalPage: 3 },
      },
      isLoading: false,
    })
    mockDeleteCompliance.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const { rerender } = render(
      <MemoryRouter>
        <CompliancePage />
      </MemoryRouter>
    )

    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )
    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )

    let lastArgs =
      mockUseGetAllComplianceQuery.mock.calls[
        mockUseGetAllComplianceQuery.mock.calls.length - 1
      ][0]
    expect(lastArgs.page).toBe(3)

    const row = screen.getByText("GDPR Article 30 records").closest("tr")!
    await user.click(
      within(row).getByText("organization.compliance.deleteObligation")
    )

    await user.click(
      screen.getByRole("button", {
        name: "common.deleteAlertModal.delete",
      })
    )

    await waitFor(() =>
      expect(mockDeleteCompliance).toHaveBeenCalledWith("comp-1")
    )

    // Deleting the last obligation on page 3 drops total to 25 -> totalPage
    // 2, stranding page 3 out of range. Unlike the other 5 list pages,
    // CompliancePage's handleDelete has no local setState on success -- in
    // the real app the re-render comes from RTK Query's own cache
    // subscription reacting to the invalidated list query, which this
    // fully-mocked hook can't reproduce on its own, so the refreshed
    // (smaller) result is applied via an explicit rerender here, standing in
    // for that cache-driven re-render.
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [],
        meta: { page: 3, limit: 20, total: 25, totalPage: 2 },
      },
      isLoading: false,
    })
    rerender(
      <MemoryRouter>
        <CompliancePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      lastArgs =
        mockUseGetAllComplianceQuery.mock.calls[
          mockUseGetAllComplianceQuery.mock.calls.length - 1
        ][0]
      expect(lastArgs.page).toBe(2)
    })
  })

  it("passes the selected domain filter to the query and resets to page 1", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [makeObligation()],
        meta: { page: 1, limit: 20, total: 45, totalPage: 3 },
      },
      isLoading: false,
    })

    renderPage()

    // Advance to page 2 first, then change a filter — page must reset to 1.
    await user.click(
      screen.getByLabelText("organization.compliance.pagination.next")
    )

    // The domain <select> is the first combobox in the filter bar.
    const domainSelect = screen.getAllByRole("combobox")[0]
    await user.selectOptions(domainSelect, "financial")

    const lastArgs =
      mockUseGetAllComplianceQuery.mock.calls[
        mockUseGetAllComplianceQuery.mock.calls.length - 1
      ][0]
    expect(lastArgs).toMatchObject({ domain: "financial", page: 1 })
  })

  it("drives the summary count cards from scorecard statusCounts, not the page", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      // Only one row on this page, but the org has many more.
      data: {
        data: [makeObligation({ status: "in_progress" })],
        meta: { page: 1, limit: 20, total: 60, totalPage: 3 },
      },
      isLoading: false,
    })
    mockUseGetComplianceScorecardQuery.mockReturnValue({
      data: {
        data: {
          ...emptyScorecard,
          overall: { compliant: 40, total: 60, ratio: 0.67, band: "red" },
          statusCounts: { compliant: 40, non_compliant: 9, in_progress: 11 },
        },
      },
    })

    renderPage()

    // Whole-org compliant (40) and non-compliant (9) counts, not the single
    // in_progress row on the current page.
    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
  })

  // ── Create Action from a non-compliant obligation (#166) ──────────────────

  it("hides the Create Action button on a non-compliant row for a VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
  })

  it("shows a Create Action button ONLY on non-compliant rows", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
          }),
          makeObligation({
            id: "comp-ok",
            title: "Passing obligation",
            status: "compliant",
          }),
          makeObligation({
            id: "comp-wip",
            title: "In-progress obligation",
            status: "in_progress",
          }),
          makeObligation({
            id: "comp-na",
            title: "Not-applicable obligation",
            status: "not_applicable",
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    const failRow = screen.getByText("Failing obligation").closest("tr")!
    const okRow = screen.getByText("Passing obligation").closest("tr")!
    const wipRow = screen.getByText("In-progress obligation").closest("tr")!
    const naRow = screen.getByText("Not-applicable obligation").closest("tr")!

    // Only the non-compliant row exposes the remediation affordance.
    expect(
      within(failRow).getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).toBeInTheDocument()
    expect(
      within(okRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
    expect(
      within(wipRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
    expect(
      within(naRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
  })

  // User-reported bug: on a non-compliant, writable row, the "Create
  // Action" button and the row's "More actions" trigger together need
  // ~145px of content width (neither can shrink -- one has a fixed
  // 44px touch target, the other is shrink-0), but the actions column's
  // own natural content width was narrower than that, so the browser's
  // table auto-layout algorithm let the rendered buttons overflow their
  // own cell boundary and visually bleed into the Source column's badge
  // (live-verified in both light and dark mode). A min-width floor on
  // the actions <td> gives the column enough room. jsdom doesn't do real
  // layout, so this only guards that the class survives -- the actual
  // fix was verified live in the browser.
  it("gives the actions column a min-width so Create Action + the row trigger don't overflow into the Source column", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    const row = screen.getByText("Failing obligation").closest("tr")!
    const actionsTd = within(row).getByRole("button", {
      name: /organization\.compliance\.createAction\.button/i,
    }).closest("td")!
    expect(actionsTd.className).toMatch(/min-w-\[\d+px\]/)
  })

  it("shows View Action instead of Create Action once a remediation action already exists (aexa-server#531)", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
            actions: [{ id: "action-1", actionTitle: "Fix it", status: "TO_DO" }],
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    const failRow = screen.getByText("Failing obligation").closest("tr")!

    expect(
      within(failRow).queryByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).not.toBeInTheDocument()
    const viewLink = within(failRow).getByRole("link", {
      name: /organization\.compliance\.viewAction\.button/i,
    })
    expect(viewLink).toHaveAttribute("href", "/organization/finding/action-1")
  })

  it("falls back to Create Action instead of crashing when actions is missing (backend/frontend deploy out of order)", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-fail",
            title: "Failing obligation",
            status: "non_compliant",
            actions: undefined,
          }),
        ],
      },
      isLoading: false,
    })

    expect(() => renderPage()).not.toThrow()

    const failRow = screen.getByText("Failing obligation").closest("tr")!
    expect(
      within(failRow).getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    ).toBeInTheDocument()
  })

  it("pre-fills a description that references the obligation even when it has no description", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-nodesc",
            title: "Undocumented control",
            description: undefined,
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    )

    const props = mockCreateActionModal.mock.calls.at(-1)![0]
    expect(props.additionalData.complianceObligationId).toBe("comp-nodesc")
    // Fallback branch (no description) still names the obligation and never
    // interpolates a literal "undefined".
    expect(props.additionalData.actionDisc).toContain("Undocumented control")
    expect(props.additionalData.actionDisc).not.toContain("undefined")
  })

  it("opens the reused Action modal pre-filled with a Remediate title and the obligation's complianceObligationId", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            id: "comp-77",
            title: "GDPR Article 30 records",
            description: "Maintain records of processing activities",
            status: "non_compliant",
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    // Modal is not mounted until the button is clicked.
    expect(screen.queryByTestId("create-action-modal")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.createAction\.button/i,
      })
    )

    expect(screen.getByTestId("create-action-modal")).toBeInTheDocument()
    const props = mockCreateActionModal.mock.calls.at(-1)![0]
    expect(props.open).toBe(true)
    // The real relation the backend (aexa-server#226) links on save.
    expect(props.additionalData.complianceObligationId).toBe("comp-77")
    // Pre-filled title references the obligation.
    expect(props.additionalData.actionTitle).toBe(
      "Remediate: GDPR Article 30 records"
    )
    // Description references the failing obligation too.
    expect(props.additionalData.actionDisc).toContain("GDPR Article 30 records")
  })

  // aexa-server#250 / aexa-frontend#212
  describe("recurrence, regulation reference, and re-attestation", () => {
    it("submits regulation_reference and recurrence on create", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockCreateCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )
      await user.type(titleInput(), "SOX annual filing")

      const regInput = screen
        .getByText("organization.compliance.form.regulationReference")
        .parentElement!.querySelector("input")!
      await user.type(regInput, "SOX Section 404")

      const recurrenceSelect = screen
        .getByText("organization.compliance.form.recurrence")
        .parentElement!.querySelector("select")!
      await user.selectOptions(recurrenceSelect, "annual")

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.form.create",
        })
      )

      await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
      const submitted = mockCreateCompliance.mock.calls[0][0]
      expect(submitted.regulation_reference).toBe("SOX Section 404")
      expect(submitted.recurrence).toBe("annual")
    })

    it("sends undefined recurrence for the default one-time option", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockCreateCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )
      await user.type(titleInput(), "One-time obligation")
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.form.create",
        })
      )

      await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
      const submitted = mockCreateCompliance.mock.calls[0][0]
      // Round 4 (industry-standards finding): the backend's zod schema
      // types these as `z.string().optional()` (string | undefined), not
      // string | null -- sending null failed validation with "expected
      // string, received null", breaking the minimal-field (Title only)
      // create path. Confirmed against compliance.validation.ts.
      expect(submitted.recurrence).toBeUndefined()
      expect(submitted.regulation_reference).toBeUndefined()
    })

    it("pre-fills regulation_reference and recurrence on edit, and shows next_review_date read-only", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              regulation_reference: "GDPR Art. 30(1)",
              recurrence: "annual",
              next_review_date: "2027-01-15T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )

      const regInput = screen
        .getByText("organization.compliance.form.regulationReference")
        .parentElement!.querySelector("input")!
      expect(regInput).toHaveValue("GDPR Art. 30(1)")

      const recurrenceSelect = screen
        .getByText("organization.compliance.form.recurrence")
        .parentElement!.querySelector("select")!
      expect(recurrenceSelect).toHaveValue("annual")

      expect(
        screen.getByText(/organization\.compliance\.form\.nextReview/)
      ).toBeInTheDocument()
    })

    // Round 13 (industry-standards finding): regulation_reference had no
    // controlled framework/control catalog, unlike reference GRC tools --
    // a native <datalist> now offers a curated, searchable catalog
    // (src/utils/complianceFrameworks.ts) while still accepting free text.
    it("offers the curated framework/control catalog via the regulation reference datalist", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()
      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      const regInput = screen.getByLabelText(
        "organization.compliance.form.regulationReference"
      )
      expect(regInput).toHaveAttribute("list", "compliance-framework-controls")
      expect(
        document.getElementById("compliance-framework-controls")
      ).toBeInTheDocument()
      expect(
        screen.getByText("Records of processing activities")
      ).toBeInTheDocument()
    })

    // Round 13 (accessibility finding, fresh full-panel re-score): form
    // labels had no htmlFor/id association -- a screen reader got no
    // programmatic name for these fields (WCAG 1.3.1/4.1.2). Spot-checks a
    // representative field via getByLabelText, which only resolves through
    // a real label/control association (not proximity, unlike the
    // `.parentElement!.querySelector(...)` pattern used elsewhere in this
    // file for fields this round didn't need to touch).
    it("associates the title and regulation reference fields with their labels for screen readers", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()
      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      expect(
        screen.getByLabelText(/organization\.compliance\.form\.title/)
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText(
          "organization.compliance.form.regulationReference"
        )
      ).toBeInTheDocument()
    })

    // Round 13: a regulation_reference that exactly matches the curated
    // catalog gets a structured framework badge in the table row; a
    // custom/free-text reference outside the catalog does not.
    it("shows a framework badge for a catalog-matched regulation reference, but not for a custom one", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              id: "catalog-match",
              title: "Catalog-matched obligation",
              regulation_reference:
                "GDPR Art. 30 — Records of processing activities",
            }),
            makeObligation({
              id: "custom-ref",
              title: "Custom-ref obligation",
              regulation_reference: "Internal Policy 4.2",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const catalogRow = screen
        .getByText("Catalog-matched obligation")
        .closest("tr")!
      expect(within(catalogRow).getByText("GDPR")).toBeInTheDocument()

      const customRow = screen.getByText("Custom-ref obligation").closest("tr")!
      expect(within(customRow).queryByText("GDPR")).not.toBeInTheDocument()
      expect(
        within(customRow).getByText("Internal Policy 4.2")
      ).toBeInTheDocument()
    })

    // Round 16 (industry-standards finding, fresh full-panel re-score): the
    // round-13 badge was per-row only -- nothing rolled catalog-matched
    // obligations up to a framework-level readiness view the way reference
    // GRC tools (Vanta, Drata) do ("SOC 2: 6/7 attested").
    describe("framework coverage rollup (round 16)", () => {
      it("tallies catalog-matched obligations per framework, ignoring custom references", () => {
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: {
            data: [
              makeObligation({
                id: "gdpr-1",
                title: "GDPR obligation 1",
                regulation_reference:
                  "GDPR Art. 30 — Records of processing activities",
                status: "compliant",
              }),
              makeObligation({
                id: "gdpr-2",
                title: "GDPR obligation 2",
                regulation_reference:
                  "GDPR Art. 32 — Security of processing",
                status: "non_compliant",
              }),
              makeObligation({
                id: "soc2-1",
                title: "SOC 2 obligation",
                regulation_reference:
                  "SOC 2 CC6.1 — Logical and physical access controls",
                status: "compliant",
              }),
              makeObligation({
                id: "custom-ref",
                title: "Custom-ref obligation",
                regulation_reference: "Internal Policy 4.2",
                status: "compliant",
              }),
            ],
          },
          isLoading: false,
        })

        renderPage()

        const panel = screen
          .getByText("organization.compliance.frameworkCoverage.title")
          .closest("div")!
        expect(within(panel).getByText("GDPR")).toBeInTheDocument()
        expect(
          within(panel).getAllByText(
            "organization.compliance.frameworkCoverage.compliantOf"
          )
        ).toHaveLength(2)
        expect(within(panel).getByText("SOC 2")).toBeInTheDocument()
      })

      it("hides the panel entirely when no loaded obligation matches the catalog", () => {
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: {
            data: [makeObligation({ regulation_reference: "Internal Policy 4.2" })],
          },
          isLoading: false,
        })

        renderPage()

        expect(
          screen.queryByText("organization.compliance.frameworkCoverage.title")
        ).not.toBeInTheDocument()
      })

      // Round 19 (accessibility finding, fresh full-panel re-score): the
      // tiles were plain divs with no grouping semantics -- a screen
      // reader had no way to know how many frameworks were present or
      // navigate them as a set.
      it("groups the framework tiles as a list for screen reader navigation", () => {
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: {
            data: [
              makeObligation({
                id: "gdpr-1",
                regulation_reference:
                  "GDPR Art. 30 — Records of processing activities",
              }),
              makeObligation({
                id: "soc2-1",
                regulation_reference:
                  "SOC 2 CC6.1 — Logical and physical access controls",
              }),
            ],
          },
          isLoading: false,
        })

        renderPage()

        const panel = screen
          .getByText("organization.compliance.frameworkCoverage.title")
          .closest("div")!
        expect(within(panel).getAllByRole("listitem")).toHaveLength(2)
      })
    })

    // Round-1 review of PR #859: the fix for CREATE's null-vs-undefined
    // 400 (below) must NOT be applied to UPDATE too -- fetchBaseQuery's
    // JSON.stringify drops `undefined` keys entirely, and Prisma treats an
    // absent key as "leave this column unchanged," not "clear it." Clearing
    // a previously-set field via edit must still send an explicit `null`,
    // matching the backend's only currently-supported "clear a value on
    // update" mechanism (the same one site_id already relies on).
    it("sends explicit null (not undefined) when clearing a previously-set regulation_reference/recurrence on edit", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              regulation_reference: "GDPR Art. 30(1)",
              recurrence: "annual",
            }),
          ],
        },
        isLoading: false,
      })
      mockUpdateCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )

      const regInput = screen
        .getByText("organization.compliance.form.regulationReference")
        .parentElement!.querySelector("input")!
      await user.clear(regInput)

      const recurrenceSelect = screen
        .getByText("organization.compliance.form.recurrence")
        .parentElement!.querySelector("select")!
      await user.selectOptions(recurrenceSelect, "")

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.form.update",
        })
      )

      await waitFor(() => expect(mockUpdateCompliance).toHaveBeenCalled())
      const submitted = mockUpdateCompliance.mock.calls[0][0].data
      expect(submitted.regulation_reference).toBeNull()
      expect(submitted.recurrence).toBeNull()
    })

    // Found live-verifying feat/compliance-edit-history-ui: the frontend
    // always resends regulation_reference/recurrence as null when blank on
    // EVERY save, not only when the user actively clears a previously-set
    // value -- editing an obligation whose fields were already unset, and
    // touching only an unrelated field (title here), still sends the same
    // null shape. Before aexa-server's update_compliance schema was fixed
    // to accept null for these two fields, this exact case 400'd. This
    // pins the payload shape so a future change to only-send-changed-fields
    // doesn't silently drop the null the backend now correctly relies on.
    it("still sends null for already-blank regulation_reference/recurrence when editing an unrelated field", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              regulation_reference: null,
              recurrence: null,
            }),
          ],
        },
        isLoading: false,
      })
      mockUpdateCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )

      await user.type(titleInput(), " (revised)")

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.form.update",
        })
      )

      await waitFor(() => expect(mockUpdateCompliance).toHaveBeenCalled())
      const submitted = mockUpdateCompliance.mock.calls[0][0].data
      expect(submitted.title).toBe("GDPR Article 30 records (revised)")
      expect(submitted.regulation_reference).toBeNull()
      expect(submitted.recurrence).toBeNull()
    })

    // Round-3 industry-standards finding: line_of_defense was already
    // returned/settable by the backend (Issue #97) but had no field
    // anywhere in this form and was never displayed in the list.
    describe("line of defense (round 3)", () => {
      it("displays the obligation's line of defense in the list", () => {
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: {
            data: [makeObligation({ line_of_defense: "THIRD" })],
          },
          isLoading: false,
        })

        renderPage()

        expect(
          screen.getByText(/organization\.threeLinesOfDefense\.lines\.third/)
        ).toBeInTheDocument()
      })

      it("defaults the create form's line of defense to SECOND, matching the backend's own DB default", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [] },
          isLoading: false,
        })
        mockCreateCompliance.mockReturnValue({
          unwrap: () => Promise.resolve({ success: true }),
        })

        renderPage()
        await user.click(
          screen.getByRole("button", {
            name: /organization\.compliance\.newObligation/i,
          })
        )
        await user.type(titleInput(), "New obligation")
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.form.create",
          })
        )

        await waitFor(() => expect(mockCreateCompliance).toHaveBeenCalled())
        expect(mockCreateCompliance.mock.calls[0][0].line_of_defense).toBe(
          "SECOND"
        )
      })

      it("pre-fills and lets the user change line of defense on edit", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: {
            data: [makeObligation({ line_of_defense: "FIRST" })],
          },
          isLoading: false,
        })
        mockUpdateCompliance.mockReturnValue({
          unwrap: () => Promise.resolve({ success: true }),
        })

        renderPage()
        const row = screen.getByText("GDPR Article 30 records").closest("tr")!
        await user.click(
          within(row).getByText("organization.compliance.editObligation")
        )

        const lineSelect = screen
          .getByText("organization.compliance.form.lineOfDefense")
          .parentElement!.querySelector("select")!
        expect(lineSelect).toHaveValue("FIRST")

        await user.selectOptions(lineSelect, "THIRD")
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.form.update",
          })
        )

        await waitFor(() => expect(mockUpdateCompliance).toHaveBeenCalled())
        expect(
          mockUpdateCompliance.mock.calls[0][0].data.line_of_defense
        ).toBe("THIRD")
      })
    })

    it("shows an overdue badge driven by the server-computed overdue flag, not a client-side due_date check", () => {
      // due_date is in the future, but the server says overdue anyway (e.g. a
      // recurring obligation whose next_review_date has lapsed) -- if the
      // component still re-derived this from due_date alone, this would fail.
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2099-01-01T00:00:00.000Z",
              overdue: true,
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText("organization.compliance.overdueLabel")
      ).toBeInTheDocument()
    })

    it("does not show the overdue badge when overdue is false, even with a past due_date", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2020-01-01T00:00:00.000Z",
              overdue: false,
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.queryByText("organization.compliance.overdueLabel")
      ).not.toBeInTheDocument()
    })

    // Round 9 (UX finding, fresh full-panel re-score): the Due Date column
    // (with the table's only overdue indicator) is hidden below `md`, a
    // genuine mobile triage loss. A compact overdue line was added to the
    // title cell, gated `md:hidden` (round-1 review of PR #882: the
    // original version had no breakpoint gate at all, duplicating the
    // exact same "Overdue" signal in both this line AND the Due Date
    // column's own badge once the column becomes visible at `md`+) so it
    // fills only the real gap below `md` and defers to the full column
    // above it, same "don't show the same fact twice" discipline the
    // sibling description/regulation_reference/line_of_defense lines
    // (`sm:block`-gated) already follow.
    it("shows a compact overdue indicator in the title cell, hidden at md+ where the Due Date column takes over", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              title: "Overdue Obligation",
              due_date: "2020-01-01T00:00:00.000Z",
              overdue: true,
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const titleCell = screen.getByText("Overdue Obligation").closest("td")
      expect(titleCell).not.toBeNull()
      const compactIndicator = within(titleCell!).getByText((_, el) =>
        el?.textContent?.startsWith("organization.compliance.overdueLabel") ??
        false
      )
      expect(compactIndicator.className).toContain("md:hidden")
    })

    it("does not show the compact overdue indicator when overdue is false", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              title: "Fine Obligation",
              overdue: false,
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const titleCell = screen.getByText("Fine Obligation").closest("td")
      expect(titleCell).not.toBeNull()
      expect(
        within(titleCell!).queryByText((_, el) =>
          el?.textContent?.startsWith("organization.compliance.overdueLabel") ??
          false
        )
      ).not.toBeInTheDocument()
    })

    it("shows the evidence-required warning when status is compliant with no attachments", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      expect(
        screen.queryByText(
          "organization.compliance.form.evidenceRequiredWarning"
        )
      ).not.toBeInTheDocument()

      const statusSelect = screen
        .getByText("organization.compliance.form.status")
        .parentElement!.querySelector("select")!
      await user.selectOptions(statusSelect, "compliant")

      expect(
        screen.getByText("organization.compliance.form.evidenceRequiredWarning")
      ).toBeInTheDocument()
    })

    // Round 19 (accessibility finding, fresh full-panel re-score): this
    // warning appears/disappears purely from a Status change with no
    // aria-live announcement, unlike every other error banner on this page
    // (sitesError, complianceError, scorecardError all use role="alert"),
    // so a screen reader user changing Status to "Compliant" got no
    // notification a new blocking warning just appeared.
    it("announces the evidence-required warning via role=alert", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      const statusSelect = screen
        .getByText("organization.compliance.form.status")
        .parentElement!.querySelector("select")!
      await user.selectOptions(statusSelect, "compliant")

      expect(screen.getByRole("alert")).toHaveTextContent(
        "organization.compliance.form.evidenceRequiredWarning"
      )
    })

    // Round 19 (accessibility finding): attachment links open target="_blank"
    // with only an icon + filename, giving a screen reader no indication
    // that activating the link leaves the page.
    it("gives each attachment link a visually-hidden opens-in-new-tab cue", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              attachments: ["https://cdn.example/evidence.pdf"],
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )

      const attachmentLink = screen.getByRole("link", {
        name: /evidence\.pdf.*organization\.compliance\.form\.attachmentOpensInNewTab/,
      })
      expect(attachmentLink).toHaveAttribute(
        "href",
        "https://cdn.example/evidence.pdf"
      )
    })

    it("opens the re-attest modal and calls attestCompliance with a trimmed note", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockAttestCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      const noteInput = screen.getByPlaceholderText(
        "organization.compliance.attest.notePlaceholder"
      )
      await user.type(noteInput, "  Confirmed with legal  ")
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      )

      await waitFor(() =>
        expect(mockAttestCompliance).toHaveBeenCalledWith({
          id: "comp-1",
          note: "Confirmed with legal",
        })
      )
      expect(mockToastSuccess).toHaveBeenCalled()
    })

    it("sends undefined (not an empty string) for note when the re-attest modal is confirmed blank", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockAttestCompliance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      )

      await waitFor(() =>
        expect(mockAttestCompliance).toHaveBeenCalledWith({
          id: "comp-1",
          note: undefined,
        })
      )
    })

    it("shows an error toast when attestCompliance fails", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockAttestCompliance.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "Obligation not found" } }),
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      )

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Obligation not found")
      )
    })

    it("opens the attestation history modal and renders entries from the query", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: {
          data: [
            {
              id: "att-1",
              org_account_id: "org-a",
              obligation_id: "comp-1",
              attested_by: "acct-9",
              attested_at: "2026-06-01T10:00:00.000Z",
              status_at_attestation: "compliant",
              note: "Confirmed with legal counsel",
              createdAt: "2026-06-01T10:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByText("Confirmed with legal counsel")
      ).toBeInTheDocument()
      // The query should be scoped to this specific obligation, not skipped.
      expect(mockUseGetComplianceAttestationsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ id: "comp-1" }),
        expect.objectContaining({ skip: false })
      )
    })

    // aexa-frontend#465 -- the attestation history modal's icon-only close
    // button had no aria-label.
    it("labels the attestation history modal's close button", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyModalClose",
        })
      ).toBeInTheDocument()
    })

    // Round 4 (code quality finding): isError was previously discarded on
    // this query, so a fetch failure fell through to the same "no
    // attestations yet" empty state a genuinely never-attested obligation
    // renders, indistinguishable from a real outage.
    it("shows a distinct error message, not the empty state, when the attestation history fetch fails", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByText("organization.compliance.attest.historyLoadError")
      ).toBeInTheDocument()
      expect(
        screen.queryByText("organization.compliance.attest.historyEmpty")
      ).not.toBeInTheDocument()
    })

    // Quality-bar-loop industry-standards gap: the history modal grew a
    // second "Edit History" tab, fetched alongside attestations behind the
    // same historyObligation-gated skip.
    describe("edit history tab (quality-bar-loop)", () => {
      it("fetches edit history scoped to the obligation once the history modal opens", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [makeObligation()] },
          isLoading: false,
        })

        renderPage()

        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.attest.historyButton",
          })
        )

        expect(mockUseGetComplianceEditHistoryQuery).toHaveBeenCalledWith(
          expect.objectContaining({ id: "comp-1" }),
          expect.objectContaining({ skip: false })
        )
      })

      it("shows the edit-history empty state on the Edit History tab, not mixed into the attestations tab", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [makeObligation()] },
          isLoading: false,
        })
        mockUseGetComplianceEditHistoryQuery.mockReturnValue({
          data: { data: [] },
          isLoading: false,
        })

        renderPage()
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.attest.historyButton",
          })
        )
        await user.click(
          screen.getByRole("tab", {
            name: "organization.compliance.editHistory.tabLabel",
          })
        )

        expect(
          screen.getByText("organization.compliance.editHistory.empty")
        ).toBeInTheDocument()
      })

      it("renders a field-level diff for each edit-history entry", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [makeObligation()] },
          isLoading: false,
        })
        mockUseGetComplianceEditHistoryQuery.mockReturnValue({
          data: {
            data: [
              {
                id: "edit-1",
                org_account_id: "org-a",
                obligation_id: "comp-1",
                edited_by: "acct-9",
                edited_at: "2026-06-01T10:00:00.000Z",
                changes: {
                  title: { old: "Old title", new: "New title" },
                },
                createdAt: "2026-06-01T10:00:00.000Z",
              },
            ],
          },
          isLoading: false,
        })

        renderPage()
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.attest.historyButton",
          })
        )
        await user.click(
          screen.getByRole("tab", {
            name: "organization.compliance.editHistory.tabLabel",
          })
        )

        expect(screen.getByText(/Old title/)).toBeInTheDocument()
        expect(screen.getByText(/New title/)).toBeInTheDocument()
        expect(
          screen.getByText("organization.compliance.editHistory.editedByLabel")
        ).toBeInTheDocument()
      })

      it("shows a distinct error message, not the empty state, when the edit-history fetch fails", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [makeObligation()] },
          isLoading: false,
        })
        mockUseGetComplianceEditHistoryQuery.mockReturnValue({
          data: undefined,
          isLoading: false,
          isError: true,
        })

        renderPage()
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.attest.historyButton",
          })
        )
        await user.click(
          screen.getByRole("tab", {
            name: "organization.compliance.editHistory.tabLabel",
          })
        )

        expect(
          screen.getByText("organization.compliance.editHistory.loadError")
        ).toBeInTheDocument()
        expect(
          screen.queryByText("organization.compliance.editHistory.empty")
        ).not.toBeInTheDocument()
      })

      it("defaults to the Attestations tab when the history modal opens", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [makeObligation()] },
          isLoading: false,
        })

        renderPage()
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.attest.historyButton",
          })
        )

        expect(
          screen.getByRole("tab", {
            name: "organization.compliance.attest.tabLabel",
          })
        ).toHaveAttribute("aria-selected", "true")
        expect(
          screen.getByRole("tab", {
            name: "organization.compliance.editHistory.tabLabel",
          })
        ).toHaveAttribute("aria-selected", "false")
      })

      // Round 12 (accessibility finding, fresh full-panel re-score):
      // role="tab" with correct aria-selected/aria-controls isn't the full
      // WAI-ARIA APG tabs pattern on its own -- a keyboard user could Tab to
      // the tablist but had no Arrow-key way to move between tabs.
      it("switches tabs with ArrowRight/ArrowLeft and moves focus with them", async () => {
        const user = userEvent.setup()
        mockUseGetAllComplianceQuery.mockReturnValue({
          data: { data: [makeObligation()] },
          isLoading: false,
        })

        renderPage()
        await user.click(
          screen.getByRole("button", {
            name: "organization.compliance.attest.historyButton",
          })
        )

        const attestationsTab = screen.getByRole("tab", {
          name: "organization.compliance.attest.tabLabel",
        })
        const editsTab = screen.getByRole("tab", {
          name: "organization.compliance.editHistory.tabLabel",
        })

        attestationsTab.focus()
        await user.keyboard("{ArrowRight}")

        expect(editsTab).toHaveAttribute("aria-selected", "true")
        expect(editsTab).toHaveFocus()
        expect(attestationsTab).toHaveAttribute("tabIndex", "-1")

        await user.keyboard("{ArrowLeft}")

        expect(attestationsTab).toHaveAttribute("aria-selected", "true")
        expect(attestationsTab).toHaveFocus()
      })
    })

    // aexa-frontend round-4 audit bug #333: entry.attested_by was never
    // rendered despite a comment claiming it was shown as-is.
    it("renders the attester's raw accountId for each history entry", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: {
          data: [
            {
              id: "att-1",
              org_account_id: "org-a",
              obligation_id: "comp-1",
              attested_by: "acct-9",
              attested_at: "2026-06-01T10:00:00.000Z",
              status_at_attestation: "compliant",
              note: null,
              createdAt: "2026-06-01T10:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByText("organization.compliance.attest.attestedByLabel")
      ).toBeInTheDocument()
    })

    // aexa-frontend round-3 audit bug #3: entry.attested_at was hardcoded
    // to "en-US" regardless of the active UI language.
    it("formats the attestation date in French when the UI language is French", async () => {
      mockLanguage = "fr"
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: {
          data: [
            {
              id: "att-1",
              org_account_id: "org-a",
              obligation_id: "comp-1",
              attested_by: "acct-9",
              attested_at: "2026-06-01T10:00:00.000Z",
              status_at_attestation: "compliant",
              note: "Confirmed with legal counsel",
              createdAt: "2026-06-01T10:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      const expected = new Date("2026-06-01T10:00:00.000Z").toLocaleDateString(
        "fr-FR",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it("shows the empty state in the history modal when there are no attestations", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      expect(
        screen.getByText("organization.compliance.attest.historyEmpty")
      ).toBeInTheDocument()
    })

    it("skips the attestations query until the history modal is opened", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      renderPage()

      expect(mockUseGetComplianceAttestationsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ id: "" }),
        expect.objectContaining({ skip: true })
      )
    })

    // Regression for a round-1 review finding: actionObligation/
    // attestObligation/historyObligation used to be independent state, so
    // opening one modal without dismissing another left the first one
    // stacked underneath, invisible but still mounted.
    it("closes the re-attest modal when the history modal is opened for a different row", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({ id: "comp-1", title: "GDPR Article 30 records" }),
            makeObligation({ id: "comp-2", title: "SOX annual filing" }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const rowA = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(rowA).getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )
      expect(
        screen.getByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      ).toBeInTheDocument()

      const rowB = screen.getByText("SOX annual filing").closest("tr")!
      await user.click(
        within(rowB).getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      // History modal (row B) is open...
      expect(
        screen.getByText("organization.compliance.attest.historyEmpty")
      ).toBeInTheDocument()
      // ...and the re-attest modal (row A) is gone, not just hidden behind it.
      expect(
        screen.queryByRole("button", {
          name: "organization.compliance.attest.confirmButton",
        })
      ).not.toBeInTheDocument()
    })
  })

  // Round 4 (code quality finding): isError was previously discarded on
  // useGetAllSitesQuery, so a fetch failure fell through to the same empty
  // site select a genuinely site-less org shows, indistinguishable from a
  // real outage.
  describe("sites query resilience (round 4)", () => {
    it("shows a non-blocking error message under the site select when the sites fetch fails", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetAllSitesQuery.mockReturnValue({
        data: undefined,
        isError: true,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      expect(
        screen.getByText("organization.compliance.sitesLoadError")
      ).toBeInTheDocument()
      // Non-blocking: the form itself (and its site select) still renders.
      expect(
        screen.getByText("organization.compliance.form.orgWide")
      ).toBeInTheDocument()
    })

    it("does not show the sites error message when the fetch succeeds", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })
      mockUseGetAllSitesQuery.mockReturnValue({
        data: { data: [{ id: "site-1", name: "Casablanca HQ" }] },
        isError: false,
      })

      renderPage()

      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      expect(
        screen.queryByText("organization.compliance.sitesLoadError")
      ).not.toBeInTheDocument()
    })
  })

  // aexa-frontend#244: due_date/next_review_date are date-only values -- the
  // backend's DATE columns serialize as UTC-midnight ISO strings (see
  // makeObligation's "...T00:00:00.000Z" fixtures above, matching the real
  // /api/compliance response shape). `new Date(obl.due_date).toLocaleDateString()`
  // parses that as a UTC instant but formats in the *local* timezone, which
  // rolls the displayed day back one for anyone at a negative UTC offset.
  // Same root cause as #238 (already fixed for the findings due-date
  // datetime-local input), different mechanism (date-only, not datetime).
  describe("due date / next review date rendering is timezone-safe (#244)", () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it("renders the correct calendar day for due_date and next_review_date at a negative UTC offset (west of UTC)", () => {
      // Pacific/Honolulu is UTC-10 with no DST -- deterministic year-round.
      // Under the bug, a UTC-midnight due_date would display one day early.
      vi.stubEnv("TZ", "Pacific/Honolulu")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2026-12-31T00:00:00.000Z",
              recurrence: "annual",
              next_review_date: "2027-06-15T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("Dec 31, 2026")).toBeInTheDocument()
      expect(screen.getByText(/Jun 15, 2027/)).toBeInTheDocument()
    })

    it("renders the correct calendar day for due_date at a positive UTC offset (east of UTC)", () => {
      // IST, UTC+5:30 -- a positive offset wouldn't have shown the #244 bug
      // (it rolls the day *forward*, not backward), but it must still
      // render correctly, not just avoid the specific failure direction.
      vi.stubEnv("TZ", "Asia/Kolkata")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [makeObligation({ due_date: "2026-01-01T00:00:00.000Z" })],
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("Jan 1, 2026")).toBeInTheDocument()
    })

    it("renders the correct calendar day in the edit form's derived next-review note at a negative UTC offset", async () => {
      const user = userEvent.setup()
      vi.stubEnv("TZ", "Pacific/Honolulu")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              recurrence: "annual",
              next_review_date: "2026-03-01T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )

      expect(
        screen.getByText(/organization\.compliance\.form\.nextReview/)
      ).toHaveTextContent("Mar 1, 2026")
    })

    it("still renders the correct calendar day for a next_review_date with a real, non-midnight time-of-day", () => {
      // aexa-server's attest_compliance_into_db recomputes next_review_date
      // from the actual attestation clock time, not midnight (see
      // dueDateInput.ts's comment) -- unlike due_date, this field genuinely
      // carries a non-zero time-of-day in production. formatDateOnlyForDisplay
      // still truncates to a single UTC calendar day rather than letting that
      // time-of-day leak into the display or interact with the local offset.
      vi.stubEnv("TZ", "Pacific/Honolulu")

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              recurrence: "annual",
              next_review_date: "2027-03-01T23:50:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText(/Mar 1, 2027/)).toBeInTheDocument()
    })

    // aexa-frontend#390: formatDateOnlyForDisplay hardcoded "en-US" with no
    // locale argument, so due_date/next_review_date always rendered English
    // month names even under the French UI -- same bug class as #3/#4 in the
    // round-3 audit, now fixed by threading i18n.language through to the
    // shared formatLocaleDate() helper instead.
    it("formats due_date and next_review_date in French when the UI language is French", () => {
      mockLanguage = "fr"

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              due_date: "2026-12-31T00:00:00.000Z",
              recurrence: "annual",
              next_review_date: "2027-06-15T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const expectedDueDate = new Date(
        Date.UTC(2026, 11, 31)
      ).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
      const expectedNextReview = new Date(
        Date.UTC(2027, 5, 15)
      ).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })

      expect(screen.getByText(expectedDueDate)).toBeInTheDocument()
      expect(
        screen.getByText(new RegExp(expectedNextReview))
      ).toBeInTheDocument()
    })

    // Same bug (#390), but the edit form's read-only next-review note is a
    // third, separate call site of formatDateOnlyForDisplay -- distinct from
    // the two table call sites covered above -- so it needs its own
    // assertion rather than assuming the fix at one call site covers all.
    it("formats the edit form's next-review note in French when the UI language is French", async () => {
      mockLanguage = "fr"
      const user = userEvent.setup()

      mockUseGetAllComplianceQuery.mockReturnValue({
        data: {
          data: [
            makeObligation({
              recurrence: "annual",
              next_review_date: "2026-03-01T00:00:00.000Z",
            }),
          ],
        },
        isLoading: false,
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )

      const expectedNextReview = new Date(
        Date.UTC(2026, 2, 1)
      ).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })

      expect(
        screen.getByText(/organization\.compliance\.form\.nextReview/)
      ).toHaveTextContent(expectedNextReview)
    })
  })

  // aexa-frontend#490 -- all three of this page's hand-rolled modals (form,
  // re-attest confirm, attestation history) had no role="dialog", no
  // aria-modal and no Escape handling, unlike KRI's modals (round 10, #487).
  describe("modal accessibility", () => {
    it("marks the Create/Edit form modal as a labeled dialog and closes it on Escape", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()
      await user.click(
        screen.getByRole("button", {
          name: /organization\.compliance\.newObligation/i,
        })
      )

      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")
      expect(dialog).toHaveAccessibleName(
        "organization.compliance.form.newTitle"
      )

      await user.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("marks the re-attest confirm modal as a labeled dialog and closes it on Escape", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      renderPage()
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.button",
        })
      )

      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")
      expect(dialog).toHaveAccessibleName(
        "organization.compliance.attest.modalTitle"
      )

      await user.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("marks the attestation history modal as a labeled dialog and closes it on Escape", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()
      await user.click(
        screen.getByRole("button", {
          name: "organization.compliance.attest.historyButton",
        })
      )

      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-modal", "true")

      await user.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    // Round-11 review finding: attestObligation/historyObligation each have
    // their own useModalA11y() instance, and openAttest/openHistory close
    // the sibling before opening the new one -- so React runs the closing
    // modal's cleanup (which returns focus to ITS OWN trigger) and the
    // opening modal's setup (which captures document.activeElement as ITS
    // trigger) in the same commit, cleanup-before-setup. Without the
    // pendingFocusRef fix, that ordering steals focus away from the
    // just-clicked button before the new modal's setup can capture it, so
    // closing the newly opened modal would wrongly return focus to the
    // OTHER modal's trigger. This asserts the real clicked button gets
    // focus back, not the sibling's.
    it("returns focus to the History button (not the stale Attest trigger) after switching directly from the Attest modal to the History modal and closing it", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })
      mockUseGetComplianceAttestationsQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()

      const attestButton = screen.getByRole("button", {
        name: "organization.compliance.attest.button",
      })
      await user.click(attestButton)
      expect(screen.getByRole("dialog")).toBeInTheDocument()

      const historyButton = screen.getByRole("button", {
        name: "organization.compliance.attest.historyButton",
      })
      await user.click(historyButton)
      expect(screen.getByRole("dialog")).toBeInTheDocument()

      await user.keyboard("{Escape}")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(document.activeElement).toBe(historyButton)
    })
  })

  // aexa-frontend#508 round 13 -- the search input, domain filter select and
  // status filter select relied on placeholder/default-option text alone,
  // with no aria-label/associated label giving them an accessible name.
  describe("filter accessibility (#508)", () => {
    it("gives the search input, domain filter, and status filter accessible names", () => {
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [] },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByRole("textbox", {
          name: "organization.compliance.searchLabel",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("combobox", {
          name: "organization.compliance.domainFilterLabel",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("combobox", {
          name: "organization.compliance.statusFilterLabel",
        })
      ).toBeInTheDocument()
    })
  })

  // quality-bar-loop-derived fix: none of this file's raw <button> elements
  // declared type="button", defaulting to the implicit type="submit" --
  // harmless only because this page's markup doesn't currently sit inside a
  // <form>, but a real footgun if it ever does. This file renders no shadcn
  // <Button> (that gap is scoped elsewhere), so a full sweep is safe here --
  // every interaction below mounts a different conditional button/modal so
  // the sweep actually covers them, not just whatever's visible by default.
  it("gives every button an explicit type so none default to implicit submit", async () => {
    const user = userEvent.setup()
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: {
        data: [
          makeObligation({
            status: "non_compliant",
            attachments: ["https://files.example.com/evidence-1.pdf"],
          }),
        ],
      },
      isLoading: false,
    })

    renderPage()

    const sweep = () => {
      const buttons = document.querySelectorAll("button")
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach((button) => {
        expect(button.type).toBe("button")
      })
    }

    // Default render: New Obligation, Create Action, row "more actions"
    // trigger, and the mocked dropdown's Edit/Attest/History/Delete items.
    sweep()

    // Create/Edit form modal: Close (X), remove-attachment, Cancel, Create.
    await user.click(
      screen.getByRole("button", {
        name: /organization\.compliance\.newObligation/i,
      })
    )
    sweep()
    await user.click(
      screen.getByRole("button", { name: "organization.compliance.form.close" })
    )

    // Re-attest confirm modal: Cancel, Confirm.
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.attest.button",
      })
    )
    sweep()
    await user.keyboard("{Escape}")

    // Attestation history modal: Close (X).
    await user.click(
      screen.getByRole("button", {
        name: "organization.compliance.attest.historyButton",
      })
    )
    sweep()
  })

  // quality-bar-loop round 20 (accessibility, fresh-panel finding): Radix
  // DropdownMenu's own default onCloseAutoFocus behavior returns focus to
  // the "More actions" trigger asynchronously after the dropdown closes --
  // racing against, and previously winning against, the newly-opened
  // modal's own mount-time focus() call (useModalA11y.ts), so Tab would
  // escape into the background table instead of staying trapped in the
  // modal that visually just opened. This file's own dropdown-menu mock
  // (above) fully replaces Radix's real DropdownMenuContent, so jsdom has
  // no async focus-return timing to race in the first place -- a live
  // "focus ends up in the dialog" assertion here would pass identically
  // whether or not ComplianceObligationRow.tsx actually passes
  // onCloseAutoFocus, proving nothing about this specific fix. The
  // deterministic substitute: assert the row genuinely passes a handler
  // that calls preventDefault, which the mock captures.
  it("passes an onCloseAutoFocus handler to the row's dropdown menu that prevents Radix's default focus-return", () => {
    mockUseGetAllComplianceQuery.mockReturnValue({
      data: { data: [makeObligation()] },
      isLoading: false,
    })
    capturedOnCloseAutoFocusHandlers.length = 0

    renderPage()

    expect(capturedOnCloseAutoFocusHandlers.length).toBeGreaterThan(0)
    const fakeEvent = { preventDefault: vi.fn() } as unknown as Event
    capturedOnCloseAutoFocusHandlers[0](fakeEvent)
    expect((fakeEvent as unknown as { preventDefault: () => void }).preventDefault).toHaveBeenCalled()
  })

  // Live-behavior sanity check (not sensitive to the round-20 fix itself,
  // per the comment above) -- confirms opening each dropdown-invoked modal
  // does land focus inside its own dialog, independent of the trigger.
  describe("dropdown-menu-invoked modals land focus inside their own dialog", () => {
    it.each([
      ["Edit", "organization.compliance.editObligation"],
      ["Re-attest", "organization.compliance.attest.button"],
      ["History", "organization.compliance.attest.historyButton"],
    ])("%s", async (_label, itemKey) => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      const trigger = within(row).getByRole("button", {
        name: "organization.compliance.moreActionsLabel",
      })
      await user.click(trigger)
      await user.click(within(row).getByText(itemKey))

      const dialog = await screen.findByRole("dialog")
      await waitFor(() =>
        expect(dialog.contains(document.activeElement)).toBe(true)
      )
    })
  })

  // Round 21 (accessibility, fresh-panel finding -- a regression in round
  // 20's own fix): deferring the action into onCloseAutoFocus meant
  // document.activeElement was already <body> by the time the newly-
  // opened modal's useModalA11y effect captured "whatever's currently
  // focused" as its own close-time restore target, so closing the modal
  // dropped focus to <body> instead of back to the row's "More actions"
  // trigger. Explicitly refocusing the trigger before running the
  // deferred action fixes this without needing to change every modal's
  // own focus-capture mechanism.
  describe("dropdown-menu-invoked modals restore focus to the row's trigger on close, not <body>", () => {
    it("Edit: closing the modal returns focus to the row's More-actions trigger", async () => {
      const user = userEvent.setup()
      mockUseGetAllComplianceQuery.mockReturnValue({
        data: { data: [makeObligation()] },
        isLoading: false,
      })

      renderPage()

      const row = screen.getByText("GDPR Article 30 records").closest("tr")!
      const trigger = within(row).getByRole("button", {
        name: "organization.compliance.moreActionsLabel",
      })
      await user.click(trigger)
      await user.click(
        within(row).getByText("organization.compliance.editObligation")
      )
      await screen.findByRole("dialog")

      await user.keyboard("{Escape}")

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(document.activeElement).toBe(trigger)
      expect(document.activeElement).not.toBe(document.body)
    })
  })
})
