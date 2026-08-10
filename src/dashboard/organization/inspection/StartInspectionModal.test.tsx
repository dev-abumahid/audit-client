import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import StartInspectionModal from "./StartInspectionModal"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention).

// jsdom has no ResizeObserver; cmdk (the Command palette behind the
// template/site pickers) uses it to measure list height. Only needed once
// a test actually opens a popover (added in round 2 of the quality-bar-loop
// to test the system-template exclusion).
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", MockResizeObserver)
// jsdom also doesn't implement scrollIntoView, which cmdk calls when
// highlighting an item.
Element.prototype.scrollIntoView = vi.fn()

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseGetAllSitesQuery = vi.fn()
vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) =>
    mockUseGetAllSitesQuery(...args),
}))

const mockUseGetAllTemplatesQuery = vi.fn()
vi.mock("@/redux/apis/organization/template.api", () => ({
  useGetAllTemplatesQuery: (...args: unknown[]) =>
    mockUseGetAllTemplatesQuery(...args),
}))

describe("StartInspectionModal", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockUseGetAllTemplatesQuery.mockReset()
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockUseGetAllSitesQuery.mockReset()
    mockUseGetAllSitesQuery.mockReturnValue({ data: { data: [] } })
  })

  // quality-bar-loop round 5 (Templates, industry-standards): starting a
  // real inspection against an unfinished draft template would silently
  // produce an incomplete report with no warning.
  it("excludes draft templates from the picker by querying status=PUBLISHED", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(mockUseGetAllTemplatesQuery).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PUBLISHED" })
    )
  })

  it("renders the localized title, description and field labels", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByText("organization.inspection.startNewInspection")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.startModalDescription")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.selectSite")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.selectTemplate")
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (mobile, round-1 finding): the site/template
  // combobox triggers and footer buttons measured ~28px tall live at
  // 375px width, well under the 44px touch-target guideline.
  it("gives the site/template triggers and footer buttons a 44px touch target", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByRole("combobox", {
        name: "organization.inspection.selectSite organization.inspection.chooseSite",
      }).className
    ).toMatch(/\bh-11\b/)
    expect(
      screen.getByRole("button", { name: "organization.inspection.cancel" })
        .className
    ).toMatch(/\bh-11\b/)
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.startInspection",
      }).className
    ).toMatch(/\bh-11\b/)
  })

  // quality-bar-loop round 2 (accessibility): aria-labelledby on the
  // trigger combines the static field label with the trigger's own
  // dynamic text -- pointing it at ONLY the static label would replace
  // the button's text-derived accessible name entirely (buttons are
  // labelable elements), the same bug found and fixed on AuditPage's
  // RiskMultiSelect earlier this session.
  it("gives the site trigger an accessible name that includes both the field label and the selected site", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByRole("combobox", {
        name: "organization.inspection.selectSite organization.inspection.chooseSite",
      })
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 2 (UX, round-1 finding): live-confirmed the
  // protected "AI-Generated Findings (system, do not edit)" template was
  // selectable here, with nothing preventing a real inspection from
  // being started against it.
  it("excludes the protected system template from the picker", async () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "t1",
            templateName: "Fire Safety Audit",
            status: "PUBLISHED",
          },
          {
            id: "t2",
            templateName: "⚙ AI-Generated Findings (system, do not edit)",
            status: "PUBLISHED",
          },
        ],
      },
      isLoading: false,
    })

    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    await userEvent.click(
      screen.getByRole("combobox", {
        name: "organization.inspection.selectTemplate organization.inspection.chooseTemplate",
      })
    )

    expect(await screen.findByText("Fire Safety Audit")).toBeInTheDocument()
    expect(
      screen.queryByText("⚙ AI-Generated Findings (system, do not edit)")
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 5, resilience finding): neither
  // query checked isError, so a genuine fetch failure rendered the same
  // "no site/template found" empty state as a legitimately empty org,
  // with no indication the fetch itself failed.
  it("shows a real error, not the empty-results message, when the sites fetch fails", async () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: undefined,
      isError: true,
    })

    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    await userEvent.click(
      screen.getByRole("combobox", {
        name: "organization.inspection.selectSite organization.inspection.chooseSite",
      })
    )

    expect(
      await screen.findByText("organization.inspection.sitesLoadError")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.inspection.noSiteFound")
    ).not.toBeInTheDocument()
  })

  it("shows a real error, not the empty-results message, when the templates fetch fails", async () => {
    mockUseGetAllTemplatesQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    await userEvent.click(
      screen.getByRole("combobox", {
        name: "organization.inspection.selectTemplate organization.inspection.chooseTemplate",
      })
    )

    expect(
      await screen.findByText("organization.inspection.templatesLoadError")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.inspection.noTemplateFound")
    ).not.toBeInTheDocument()
  })

  it("renders the localized footer buttons", () => {
    render(<StartInspectionModal open={true} setOpen={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: "organization.inspection.cancel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.inspection.startInspection",
      })
    ).toBeInTheDocument()
  })
})
