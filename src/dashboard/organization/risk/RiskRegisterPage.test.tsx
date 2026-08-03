import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RiskRegisterPage from "./RiskRegisterPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key with no
// interpolation for every other assertion here. That fallback can't
// reproduce the "Risks found" -> "{{count}} risk(s) found" pluralization fix
// (organization.riskRegister.subtitle_one/_other, issue #353), since
// i18next's plural-suffix resolution only kicks in once real
// resources/pluralization rules are loaded. Overriding just this one key,
// with the same singular/plural behavior the real en.json resource now has,
// lets the test tell the fixed subtitle_one/_other split apart from the old
// un-pluralized "subtitle" key -- every other key still falls back to itself
// unchanged. Same technique as CompliancePage.test.tsx / CorrelationMatrixPage.test.tsx.
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return {
        ...real,
        t: (key: string, opts?: Record<string, unknown>) => {
          if (key === "organization.riskRegister.subtitle") {
            const count = Number(opts?.count ?? 0)
            return count === 1
              ? `${count} risk found`
              : `${count} risks found`
          }
          return key
        },
      }
    },
  }
})

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const mockUseGetAllRisksQuery = vi.fn()
const mockUseGetAllSitesQuery = vi.fn()
const mockCreateNewRisk = vi.fn()
const mockUpdateRisk = vi.fn()
const mockDeleteRisk = vi.fn()
// Mutable per-test, same convention as mockRole above -- lets the loader
// regression test below flip isRiskCreating to true without a static mock.
let mockIsRiskCreating = false

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: (...args: unknown[]) => mockUseGetAllRisksQuery(...args),
  useCreateNewRiskMutation: () => [
    mockCreateNewRisk,
    { isLoading: mockIsRiskCreating },
  ],
  useUpdateRiskMutation: () => [mockUpdateRisk, { isLoading: false }],
  useDeleteRiskMutation: () => [mockDeleteRisk],
}))

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) => mockUseGetAllSitesQuery(...args),
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

// The approval column's controls (badge + role-gated actions) are covered by
// RiskApprovalControls.test.tsx. Stub it here so this page test stays focused
// on the register CRUD and doesn't need the approval api / role hook wired.
vi.mock("./RiskApprovalControls", () => ({
  default: ({ risk }: { risk: { id: string } }) => (
    <span data-testid={`approval-controls-${risk.id}`} />
  ),
}))

function makeRisk(overrides = {}) {
  return {
    id: "risk-1",
    name: "Supply chain disruption",
    description: "Critical supplier dependency",
    category: "supply_chain",
    inherent_score: 8,
    residual_score: 5,
    pagerank_score: 3,
    financial_impact_min: 100000,
    financial_impact_max: 500000,
    probability: 40,
    velocity: "high",
    trend: "worsening",
    status: "open",
    ai_generated: false,
    is_edited: false,
    site_id: "site-1",
    site: { id: "site-1", name: "HQ Casablanca" },
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  }
}

function makeSite(overrides = {}) {
  return { id: "site-1", name: "HQ Casablanca", ...overrides }
}

describe("RiskRegisterPage", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockUseGetAllRisksQuery.mockReset()
    mockUseGetAllSitesQuery.mockReset()
    mockCreateNewRisk.mockReset()
    mockUpdateRisk.mockReset()
    mockDeleteRisk.mockReset()
    mockToastError.mockReset()
    mockIsRiskCreating = false
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [makeSite()] } })
  })

  // Regression (issue #353): the subtitle used to render the literal
  // untranslated string "Risks found" with no count at all.
  it("renders the singular subtitle for a single visible risk", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    render(<RiskRegisterPage />)

    expect(screen.getByText("1 risk found")).toBeInTheDocument()
    expect(screen.queryByText("Risks found")).not.toBeInTheDocument()
  })

  it("renders the plural subtitle for multiple visible risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk(), makeRisk({ id: "risk-2" })] },
    })

    render(<RiskRegisterPage />)

    expect(screen.getByText("2 risks found")).toBeInTheDocument()
  })

  it("shows Add/Edit/Delete controls for an ADMIN", () => {
    mockRole = "ADMIN"
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    render(<RiskRegisterPage />)

    expect(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(true)
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
    ).toBe(true)
  })

  it("hides Add/Edit/Delete controls for a VIEWER", () => {
    mockRole = "VIEWER"
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    render(<RiskRegisterPage />)

    expect(
      screen.queryByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-pencil"))
    ).toBe(false)
    expect(
      screen.getAllByRole("button").some((b) => b.querySelector("svg.lucide-trash2"))
    ).toBe(false)
  })

  it("hides Add/Edit/Delete controls for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    render(<RiskRegisterPage />)

    expect(
      screen.queryByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    ).not.toBeInTheDocument()
  })

  it("renders risk rows with name, site, category and score", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    render(<RiskRegisterPage />)

    expect(screen.getByText("Supply chain disruption")).toBeInTheDocument()
    // "HQ Casablanca" also appears as a site-filter option, so there are two matches
    expect(screen.getAllByText("HQ Casablanca").length).toBeGreaterThanOrEqual(
      1
    )
    const categoryBadge = screen
      .getAllByText("organization.riskCategories.catSupplyChain")
      .find((el) => el.tagName === "SPAN")
    expect(categoryBadge).toBeInTheDocument()
    expect(screen.queryByText("supply_chain")).not.toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument() // residual_score badge
  })

  // Regression (issue #421): the Score column badge used to be colored by
  // risk.velocity (rate-of-change) instead of the actual residual_score
  // severity, so a low-severity risk with a "critical" velocity rendered
  // red and a critical-severity risk with a "low" velocity rendered green.
  it("colors the score badge by residual_score severity, not velocity", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "risk-low-score-critical-velocity",
            residual_score: 5,
            velocity: "critical",
          }),
          makeRisk({
            id: "risk-critical-score-low-velocity",
            residual_score: 95,
            velocity: "low",
          }),
        ],
      },
    })

    render(<RiskRegisterPage />)

    const lowScoreBadge = screen.getByText("5")
    expect(lowScoreBadge.className).toContain("bg-green-500/15")
    expect(lowScoreBadge.className).not.toContain("bg-destructive/15")

    const criticalScoreBadge = screen.getByText("95")
    expect(criticalScoreBadge.className).toContain("bg-destructive/15")
    expect(criticalScoreBadge.className).not.toContain("bg-green-500/15")
  })

  // Bug-fix batch: the category badge used to render the raw enum key
  // ("cyber") with no color styling instead of RISK_CATEGORIES' human label
  // and color.
  it("renders the category badge with a humanized label and the configured color", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ category: "cyber" })] },
    })

    render(<RiskRegisterPage />)

    const badge = screen
      .getAllByText("organization.riskCategories.catCyber")
      .find((el) => el.tagName === "SPAN")!
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ color: "hsl(199, 89%, 48%)" })
  })

  it("falls back to the raw category value if it's not in RISK_CATEGORIES", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ category: "totally_unknown" })] },
    })

    render(<RiskRegisterPage />)

    expect(screen.getByText("totally_unknown")).toBeInTheDocument()
  })

  it("aexa-frontend#376: formats financial_impact_max as M€ from its stored k€ units", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ financial_impact_max: 500000 })] },
    })

    render(<RiskRegisterPage />)

    // The Min/Max Impact form fields are labeled "k€" and submitted
    // unmodified, so the stored value is already in k€: 500,000 k€ / 1,000
    // = 500.0M€. Dividing by 1,000,000 instead (as aexa-frontend#236's fix
    // previously did) understated every figure 1000x, rendering "0.0M".
    expect(screen.getByText("500.0M")).toBeInTheDocument()
  })

  it("shows empty state when there are no risks", () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    const { container } = render(<RiskRegisterPage />)

    expect(container.querySelector("tbody")?.children.length).toBe(0)
  })

  it("shows fallback site label when risk has no site", () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: { data: [makeRisk({ site: undefined, site_id: "" })] },
    })

    render(<RiskRegisterPage />)

    // i18n isn't initialized in the test environment, so t() echoes the raw
    // key back (see RiskMatrixPage.test.tsx for the same convention).
    expect(
      screen.getByText("🏢 organization.riskRegister.groupFallback")
    ).toBeInTheDocument()
  })

  it('opens the create modal when "Add New Risk" is clicked', async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    expect(
      screen.getByText("organization.riskRegister.addNewRisk", {
        selector: "h2",
      })
    ).toBeInTheDocument()
  })

  // Regression (audit round 3): the submit button's loader used
  // `{isRiskCreating || (isRiskUpdating && <Loader />)}`, an
  // operator-precedence bug -- when isRiskCreating is true the whole
  // expression evaluates to the boolean `true` (not valid JSX, renders
  // nothing) instead of `<Loader />`, so the spinner never showed while a
  // risk was being created. Fixed to `{(isRiskCreating || isRiskUpdating) &&
  // <Loader />}`.
  it("shows the loading spinner on the submit button while a risk is being created", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockIsRiskCreating = true

    render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    const submitButton = screen.getByRole("button", {
      name: /organization\.riskRegister\.addRisk/,
    })
    expect(submitButton.querySelector("svg.lucide-loader")).toBeInTheDocument()
    // The old buggy expression rendered the literal boolean `true`, which
    // React drops silently -- there's no direct assertion for "nothing
    // rendered", so the meaningful check is that the loader icon is present.
  })

  it("aexa-frontend#228: constrains inherent_score, residual_score and probability to 0-100", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    for (const name of ["inherent_score", "residual_score", "probability"]) {
      const input = container.querySelector(`[name="${name}"]`)
      expect(input).toHaveAttribute("min", "0")
      expect(input).toHaveAttribute("max", "100")
    }
    // pagerank_score is deliberately NOT a 0-100 field server-side (a graph
    // centrality score, not a percentage) -- must stay unbounded.
    const pagerankInput = container.querySelector('[name="pagerank_score"]')
    expect(pagerankInput).not.toHaveAttribute("min")
    expect(pagerankInput).not.toHaveAttribute("max")
  })

  it("shows validation errors when submitting with required fields empty", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() => {
      expect(
        screen.getByText("organization.riskRegister.siteRequired")
      ).toBeInTheDocument()
      expect(
        screen.getByText("organization.riskRegister.riskNameRequired")
      ).toBeInTheDocument()
      expect(
        screen.getByText("organization.riskRegister.statusRequired")
      ).toBeInTheDocument()
    })
    expect(mockCreateNewRisk).not.toHaveBeenCalled()
  })

  it("submits the create form and calls createNewRisk with filled data", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Risk created" }),
    })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    // Form inputs aren't wired to <label for>, so query by the react-hook-form `name` attribute
    await userEvent.selectOptions(
      container.querySelector('[name="site_id"]')!,
      "site-1"
    )
    await userEvent.type(container.querySelector('[name="name"]')!, "New risk")
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
    const submitted = mockCreateNewRisk.mock.calls[0][0]
    expect(submitted).toMatchObject({
      site_id: "site-1",
      name: "New risk",
      status: "open",
    })
  })

  it("pre-fills the edit form with existing risk data", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })

    const { container } = render(<RiskRegisterPage />)
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"))
    await userEvent.click(editButtons[0])

    expect(
      screen.getByText("organization.riskRegister.editRisk")
    ).toBeInTheDocument()
    expect(container.querySelector('[name="name"]')).toHaveValue(
      "Supply chain disruption"
    )
  })

  it("opens delete confirmation and calls deleteRisk on confirm", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })
    mockDeleteRisk.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<RiskRegisterPage />)
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() => expect(mockDeleteRisk).toHaveBeenCalledWith("risk-1"))
  })

  it("shows an error toast and keeps the confirmation open when delete fails", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [makeRisk()] } })
    mockDeleteRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Risk is referenced by an action" },
        }),
    })

    render(<RiskRegisterPage />)
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"))
    await userEvent.click(deleteButtons[0])
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Risk is referenced by an action"
      )
    )
    // The mocked DeleteAlertModal only renders while `open` is still true
    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument()
  })

  it("shows an error toast and keeps the modal open when the create response indicates failure", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockCreateNewRisk.mockReturnValue({
      // manage_response.ts (aexa-server) always sends { success, message,
      // data, meta } — never an `error` key — so `message` carries the
      // failure reason here, not a nested `error.message`.
      unwrap: () =>
        Promise.resolve({
          success: false,
          message: "Name already exists",
        }),
    })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )
    await userEvent.selectOptions(
      container.querySelector('[name="site_id"]')!,
      "site-1"
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Duplicate risk"
    )
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Name already exists")
    )
    expect(
      screen.getByText("organization.riskRegister.addNewRisk", {
        selector: "h2",
      })
    ).toBeInTheDocument()
  })

  it("shows an error toast and keeps the modal open when the create request rejects (unhandled rejection)", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockCreateNewRisk.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: { message: "Server unavailable" },
        }),
    })

    const { container } = render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )
    await userEvent.selectOptions(
      container.querySelector('[name="site_id"]')!,
      "site-1"
    )
    await userEvent.type(
      container.querySelector('[name="name"]')!,
      "Risk that fails to save"
    )
    await userEvent.selectOptions(
      container.querySelector('[name="status"]')!,
      "open"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.riskRegister.addRisk" })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server unavailable")
    )
    // Modal should stay open on failure, not call setShowModal(false)
    expect(
      screen.getByText("organization.riskRegister.addNewRisk", {
        selector: "h2",
      })
    ).toBeInTheDocument()
  })

  it('narrows to PENDING_APPROVAL risks when "Pending my approval" is toggled', async () => {
    mockUseGetAllRisksQuery.mockReturnValue({
      data: {
        data: [
          makeRisk({
            id: "risk-pending",
            name: "Awaiting sign-off",
            approvalStatus: "PENDING_APPROVAL",
          }),
          makeRisk({
            id: "risk-approved",
            name: "Already approved",
            approvalStatus: "APPROVED",
          }),
          makeRisk({
            id: "risk-none",
            name: "Never submitted",
            approvalStatus: "NOT_SUBMITTED",
          }),
        ],
      },
    })

    render(<RiskRegisterPage />)

    // Before toggling, all three rows are visible.
    expect(screen.getByText("Awaiting sign-off")).toBeInTheDocument()
    expect(screen.getByText("Already approved")).toBeInTheDocument()
    expect(screen.getByText("Never submitted")).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.filterPendingApproval",
      })
    )

    // After toggling, only the PENDING_APPROVAL row remains.
    await waitFor(() =>
      expect(screen.queryByText("Already approved")).not.toBeInTheDocument()
    )
    expect(screen.getByText("Awaiting sign-off")).toBeInTheDocument()
    expect(screen.queryByText("Never submitted")).not.toBeInTheDocument()
  })

  // aexa-frontend#269 -- derive-with-override-and-staleness controls.
  describe("score override + staleness", () => {
    it("requires a reason before an inherent-score override can be submitted, then submits it once provided", async () => {
      mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
      mockCreateNewRisk.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ success: true, message: "Risk created" }),
      })

      const { container } = render(<RiskRegisterPage />)
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.addNewRisk",
        })
      )
      await userEvent.selectOptions(
        container.querySelector('[name="site_id"]')!,
        "site-1"
      )
      await userEvent.type(
        container.querySelector('[name="name"]')!,
        "Overridden risk"
      )
      await userEvent.selectOptions(
        container.querySelector('[name="status"]')!,
        "open"
      )

      // Toggle the inherent-score override on, but submit without a reason.
      await userEvent.click(
        container.querySelector('[name="inherent_is_override"]')!
      )
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.addRisk",
        })
      )

      await waitFor(() => {
        expect(
          screen.getByText(
            "organization.riskRegister.overrideReasonRequired"
          )
        ).toBeInTheDocument()
      })
      expect(mockCreateNewRisk).not.toHaveBeenCalled()

      // Provide the reason and resubmit -- matches the server's own
      // requirement (risk_scoring.ts's resolveInherentFields: reason is
      // required only when inherent_override is true).
      await userEvent.type(
        container.querySelector('[name="inherent_override_reason"]')!,
        "Board directed a manual uplift pending remediation."
      )
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.addRisk",
        })
      )

      await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
      const submitted = mockCreateNewRisk.mock.calls[0][0]
      // The client-facing `inherent_is_override` field is translated to the
      // `inherent_override` request key the API actually expects (confirmed
      // against aexa-server risk.service.ts's create_risk_into_db, which
      // reads payload.inherent_override, not payload.inherent_is_override).
      expect(submitted).toMatchObject({
        inherent_override: true,
        inherent_override_reason:
          "Board directed a manual uplift pending remediation.",
      })
      expect(submitted).not.toHaveProperty("inherent_is_override")
    })

    it("does not require a reason when the override toggle is left off", async () => {
      mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
      mockCreateNewRisk.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ success: true, message: "Risk created" }),
      })

      const { container } = render(<RiskRegisterPage />)
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.addNewRisk",
        })
      )
      await userEvent.selectOptions(
        container.querySelector('[name="site_id"]')!,
        "site-1"
      )
      await userEvent.type(
        container.querySelector('[name="name"]')!,
        "Auto-derived risk"
      )
      await userEvent.selectOptions(
        container.querySelector('[name="status"]')!,
        "open"
      )
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.addRisk",
        })
      )

      await waitFor(() => expect(mockCreateNewRisk).toHaveBeenCalled())
      const submitted = mockCreateNewRisk.mock.calls[0][0]
      // The override toggle was never touched, so inherent_override is
      // omitted entirely rather than sent as an explicit `false` -- the
      // server's resolveInherentFields treats a create request with no
      // override instruction (`!existing`) the same way either way, always
      // taking the auto-compute path, so omitting it here is equivalent to
      // sending `false` and matches the untouched-override contract the
      // update path also relies on (see the two tests below).
      expect(submitted.inherent_override).toBeUndefined()
    })

    it("re-submitting a fresh override supersedes an existing staleness flag rather than preserving it", async () => {
      // Existing risk with a STALE inherent-score override already in place.
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              inherent_score: 72,
              inherent_is_override: true,
              inherent_override_reason: "Old override reason",
              inherent_overridden_by: "acc-1",
              inherent_overridden_at: "2026-06-01T00:00:00.000Z",
              inherent_override_stale: true,
            }),
          ],
        },
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ success: true, message: "Risk updated" }),
      })

      const { container } = render(<RiskRegisterPage />)
      const editButtons = screen
        .getAllByRole("button")
        .filter((b) => b.querySelector("svg.lucide-pencil"))
      await userEvent.click(editButtons[0])

      // The toggle and reason pre-fill from the existing (stale) override.
      expect(
        container.querySelector('[name="inherent_is_override"]')
      ).toBeChecked()

      // Replace the reason with a fresh justification and resubmit -- this
      // is a brand-new override request (inherent_override: true + a new
      // reason), which the server's resolveInherentFields always resets
      // inherent_override_stale to false for (a fresh override always wins
      // over a prior staleness flag; see risk_scoring.ts's `true` branch,
      // which unconditionally sets `inherent_override_stale: false`). The
      // client doesn't send inherent_override_stale at all -- confirming
      // that below is how this test proves the client defers entirely to
      // the server for that flag rather than trying to compute/preserve it.
      const reasonField = container.querySelector(
        '[name="inherent_override_reason"]'
      )!
      await userEvent.clear(reasonField)
      await userEvent.type(reasonField, "Re-confirmed after remediation review.")
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.updateRisk",
        })
      )

      await waitFor(() => expect(mockUpdateRisk).toHaveBeenCalled())
      const { data: submitted } = mockUpdateRisk.mock.calls[0][0]
      expect(submitted).toMatchObject({
        inherent_override: true,
        inherent_override_reason: "Re-confirmed after remediation review.",
      })
      expect(submitted).not.toHaveProperty("inherent_override_stale")
      expect(submitted).not.toHaveProperty("inherent_overridden_by")
      expect(submitted).not.toHaveProperty("inherent_overridden_at")
    })

    it("editing an unrelated field does not resend an untouched override, preserving its audit trail and staleness", async () => {
      // Same stale, already-overridden risk as above, but this time the user
      // only edits the risk's name -- never touching the override toggle,
      // reason, or inherent_score. Resending inherent_override:true here
      // would make the server reset overridden_by/overridden_at to the
      // current actor/time and clear override_stale, even though nobody
      // reviewed the override -- that's the bug this test guards against.
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              inherent_score: 72,
              inherent_is_override: true,
              inherent_override_reason: "Old override reason",
              inherent_overridden_by: "acc-1",
              inherent_overridden_at: "2026-06-01T00:00:00.000Z",
              inherent_override_stale: true,
            }),
          ],
        },
      })
      mockUpdateRisk.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ success: true, message: "Risk updated" }),
      })

      const { container } = render(<RiskRegisterPage />)
      const editButtons = screen
        .getAllByRole("button")
        .filter((b) => b.querySelector("svg.lucide-pencil"))
      await userEvent.click(editButtons[0])

      const nameField = container.querySelector('[name="name"]')!
      await userEvent.clear(nameField)
      await userEvent.type(nameField, "Renamed risk")
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.riskRegister.updateRisk",
        })
      )

      await waitFor(() => expect(mockUpdateRisk).toHaveBeenCalled())
      const { data: submitted } = mockUpdateRisk.mock.calls[0][0]
      expect(submitted.name).toBe("Renamed risk")
      expect(submitted).not.toHaveProperty("inherent_override")
      expect(submitted).not.toHaveProperty("inherent_override_reason")
    })
  })

  describe("score override staleness badge", () => {
    it("shows the stale badge in the list view when residual_override_stale is true", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              residual_is_override: true,
              residual_override_stale: true,
              residual_overridden_by: "acc-9",
              residual_overridden_at: "2026-07-01T00:00:00.000Z",
            }),
          ],
        },
      })

      render(<RiskRegisterPage />)

      expect(screen.getByTestId("override-stale-badge")).toBeInTheDocument()
    })

    it("does not show the stale badge in the list view when residual_override_stale is false", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: {
          data: [
            makeRisk({
              residual_is_override: true,
              residual_override_stale: false,
              residual_overridden_by: "acc-9",
              residual_overridden_at: "2026-07-01T00:00:00.000Z",
            }),
          ],
        },
      })

      render(<RiskRegisterPage />)

      expect(
        screen.queryByTestId("override-stale-badge")
      ).not.toBeInTheDocument()
      // A fresh (non-stale) override still surfaces via the "active" badge --
      // not buried, just a visually distinct, less alarming state.
      expect(screen.getByTestId("override-active-badge")).toBeInTheDocument()
    })

    it("shows neither override badge when the score was never overridden", () => {
      mockUseGetAllRisksQuery.mockReturnValue({
        data: { data: [makeRisk({ residual_is_override: false })] },
      })

      render(<RiskRegisterPage />)

      expect(
        screen.queryByTestId("override-stale-badge")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId("override-active-badge")
      ).not.toBeInTheDocument()
    })
  })

  it("filters risks by search term via the query hook", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })

    render(<RiskRegisterPage />)
    await userEvent.type(
      screen.getByPlaceholderText("organization.riskRegister.searchPlaceholder"),
      "flood"
    )

    await waitFor(() =>
      expect(mockUseGetAllRisksQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "flood" })
      )
    )
  })

  // aexa-frontend#472 -- every <label> in this modal was a sibling of its
  // input with no htmlFor/id pairing, so a screen reader announced the
  // field's label as unrelated static text instead of the input's
  // accessible name (grep -c htmlFor was 0 in this file before the fix,
  // while 19 other files in the codebase already use it correctly).
  it("pairs every create-modal label to its input via htmlFor/id, so each field is reachable by its accessible label", async () => {
    mockUseGetAllRisksQuery.mockReturnValue({ data: { data: [] } })
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "Main Plant" }] },
    })

    render(<RiskRegisterPage />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.riskRegister.addNewRisk",
      })
    )

    const labelKeys = [
      "siteLabel",
      "categoryLabel",
      "riskNameLabel",
      "descriptionLabel",
      "inherentScoreLabel",
      "residualScoreLabel",
      "pagerankScoreLabel",
      "minImpactLabel",
      "maxImpactLabel",
      "probabilityLabel",
      "velocityLabel",
      "trendLabel",
      "statusLabel",
      "sourceInfoLabel",
      "designEffectivenessLabel",
      "operatingEffectivenessLabel",
    ]
    for (const key of labelKeys) {
      // getByLabelText only succeeds when the <label> is actually
      // programmatically associated with a form control (via htmlFor/id,
      // wrapping, or aria-labelledby) -- a plain sibling <label> (the bug)
      // would make this throw.
      expect(
        screen.getByLabelText(`organization.riskRegister.${key}`)
      ).toBeInTheDocument()
    }
  })
})
