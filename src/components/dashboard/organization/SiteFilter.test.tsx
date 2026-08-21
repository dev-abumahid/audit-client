import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type React from "react"
import SiteFilter from "./SiteFilter"

const mockUseGetAllSitesQuery = vi.fn()

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) =>
    mockUseGetAllSitesQuery(...args),
}))

// Same stand-in the codebase already uses for this Radix Select wrapper in
// InspectionTable.test.tsx: swaps it for a native <select>/<option> so
// userEvent.selectOptions keeps working without needing Radix's pointer-event
// APIs (unsupported in jsdom) to open the listbox.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (v: string) => void
    disabled?: boolean
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
}))

describe("SiteFilter", () => {
  beforeEach(() => {
    mockUseGetAllSitesQuery.mockReset()
  })

  it("renders nothing once loaded with no real sites", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    const { container } = render(
      <SiteFilter value={null} onChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  // Regression: the group-view option was a hardcoded French string
  // ("Vue Groupe (tous sites)") with no useTranslation/t() call anywhere in
  // this file, so it showed French even under the English locale. This
  // suite doesn't mock react-i18next (uninitialized i18next returns the raw
  // key), so asserting the option text is the i18n key -- not the old
  // hardcoded French literal -- proves the label now goes through t().
  it("renders the group-view option's label via i18n, not a hardcoded French string", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "Casablanca HQ", country: null }] },
      isLoading: false,
    })
    render(<SiteFilter value={null} onChange={vi.fn()} />)

    expect(
      screen.getByText(/organization\.siteFilter\.groupView/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Vue Groupe/)).not.toBeInTheDocument()
  })

  it("renders a disabled shell while still loading, instead of popping in and shifting layout", () => {
    mockUseGetAllSitesQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<SiteFilter value={null} onChange={vi.fn()} />)

    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("renders the org's real sites, not any hardcoded fixture", () => {
    mockUseGetAllSitesQuery.mockReturnValue({
      data: {
        data: [
          { id: "site-1", name: "Casablanca HQ", country: "Morocco" },
          { id: "site-2", name: "Lyon Plant", country: null },
        ],
      },
    })
    render(<SiteFilter value={null} onChange={vi.fn()} />)

    expect(screen.getByText(/Casablanca HQ \(Morocco\)/)).toBeInTheDocument()
    expect(screen.getByText(/Lyon Plant/)).toBeInTheDocument()
  })

  it("calls onChange with the real site's id when selected", async () => {
    const onChange = vi.fn()
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "Casablanca HQ", country: null }] },
    })
    render(<SiteFilter value={null} onChange={onChange} />)

    await userEvent.selectOptions(screen.getByRole("combobox"), "site-1")

    expect(onChange).toHaveBeenCalledWith("site-1")
  })

  it("calls onChange with null when the group option is selected", async () => {
    const onChange = vi.fn()
    mockUseGetAllSitesQuery.mockReturnValue({
      data: { data: [{ id: "site-1", name: "Casablanca HQ", country: null }] },
    })
    render(<SiteFilter value="site-1" onChange={onChange} />)

    await userEvent.selectOptions(screen.getByRole("combobox"), "__group__")

    expect(onChange).toHaveBeenCalledWith(null)
  })

  // PREVIEW-PROTO addition: sitesOverride lets a caller that already has
  // the site list (RiskMatrixView) skip this component's own
  // useGetAllSitesQuery entirely via RTK Query's `skip` option, avoiding a
  // redundant fetch in real usage and, as a side effect, letting a caller
  // render this component with injected mock data and zero live API calls
  // (the preview use case). These tests assert both halves of that: the
  // query is actually skipped, and the override array -- not a live-fetched
  // result -- is what renders.
  describe("sitesOverride", () => {
    it("passes skip: true to useGetAllSitesQuery when sitesOverride is provided", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        data: { data: [{ id: "live-site", name: "Should Not Render" }] },
        isLoading: false,
      })
      render(
        <SiteFilter
          value={null}
          onChange={vi.fn()}
          sitesOverride={[{ id: "site-1", name: "Casablanca HQ" }]}
        />
      )

      expect(mockUseGetAllSitesQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true })
      )
    })

    it("renders the override array, not the live-fetched result, when sitesOverride is provided", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        data: { data: [{ id: "live-site", name: "Should Not Render" }] },
        isLoading: false,
      })
      render(
        <SiteFilter
          value={null}
          onChange={vi.fn()}
          sitesOverride={[{ id: "site-1", name: "Casablanca HQ" }]}
        />
      )

      expect(screen.getByText("Casablanca HQ")).toBeInTheDocument()
      expect(screen.queryByText("Should Not Render")).not.toBeInTheDocument()
    })

    it("does not show a loading/disabled state for an override, even if the (skipped) query reports isLoading", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      })
      render(
        <SiteFilter
          value={null}
          onChange={vi.fn()}
          sitesOverride={[{ id: "site-1", name: "Casablanca HQ" }]}
        />
      )

      expect(screen.getByRole("combobox")).not.toBeDisabled()
    })

    it("renders nothing when sitesOverride is an empty array, without waiting on the skipped query", () => {
      mockUseGetAllSitesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      })
      const { container } = render(
        <SiteFilter value={null} onChange={vi.fn()} sitesOverride={[]} />
      )

      expect(container).toBeEmptyDOMElement()
    })
  })
})
