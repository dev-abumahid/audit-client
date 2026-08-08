import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import FilteredByNotice from "./FilteredByNotice"

// quality-bar-loop round 16 (code quality + accessibility regression fix):
// this component replaces 4 near-identical "filtered by X, clear filter"
// blocks that were copy-pasted across destination pages, none of which
// announced the filtered state to screen readers.
describe("FilteredByNotice", () => {
  function renderNotice(props: Partial<React.ComponentProps<typeof FilteredByNotice>> = {}) {
    return render(
      <MemoryRouter>
        <FilteredByNotice
          label="Showing open risks only"
          clearLabel="Clear filter"
          clearHref="/organization/risks"
          {...props}
        />
      </MemoryRouter>
    )
  }

  it("renders the label and a working clear-filter link", () => {
    renderNotice()

    expect(screen.getByText("Showing open risks only")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Clear filter" })
    ).toHaveAttribute("href", "/organization/risks")
  })

  it("announces itself to screen readers via role=status, an implicit live region", () => {
    renderNotice()

    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing open risks only"
    )
  })

  it("applies an id when given, so another control can reference it via aria-describedby", () => {
    renderNotice({ id: "active-status-filter-notice" })

    expect(screen.getByRole("status")).toHaveAttribute(
      "id",
      "active-status-filter-notice"
    )
  })
})
