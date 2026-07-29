import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SiteFilter from "./SiteFilter"

const mockUseGetAllSitesQuery = vi.fn()

vi.mock("@/redux/apis/organization/sites.api", () => ({
  useGetAllSitesQuery: (...args: unknown[]) =>
    mockUseGetAllSitesQuery(...args),
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
})
