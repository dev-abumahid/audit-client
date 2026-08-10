import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Pagination from "./Pagination"

// quality-bar-loop round 2 (Templates, mobile): this component is reused by
// 9 pages (AuditPage/TemplatesPage/InspectionTable/CompliancePage/
// AllFindingsPage/SitesEntities/RiskRegisterPage/AdminOrganization/
// AdminTransactions), so fixing its touch targets here fixes all of them.
describe("Pagination", () => {
  function renderPagination(
    props: Partial<React.ComponentProps<typeof Pagination>> = {}
  ) {
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={2}
        totalPages={5}
        onPageChange={onPageChange}
        prevAriaLabel="Previous page"
        nextAriaLabel="Next page"
        {...props}
      />
    )
    return { onPageChange }
  }

  it("renders nothing when there's only one page", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
        prevAriaLabel="Previous page"
        nextAriaLabel="Next page"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("gives the prev, page-number, and next buttons a 44px touch target", () => {
    renderPagination()

    const prev = screen.getByRole("button", { name: "Previous page" })
    const next = screen.getByRole("button", { name: "Next page" })
    const pageTwo = screen.getByRole("button", { name: "2" })

    expect(prev.className).toMatch(/\bh-11\b/)
    expect(prev.className).toMatch(/\bw-11\b/)
    expect(next.className).toMatch(/\bh-11\b/)
    expect(next.className).toMatch(/\bw-11\b/)
    expect(pageTwo.className).toMatch(/\bh-11\b/)
    expect(pageTwo.className).toMatch(/\bw-11\b/)
  })

  it("navigates via prev/next and page-number clicks", async () => {
    const user = userEvent.setup()
    const { onPageChange } = renderPagination()

    await user.click(screen.getByRole("button", { name: "Previous page" }))
    expect(onPageChange).toHaveBeenCalledWith(1)

    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole("button", { name: "3" }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it("disables prev on the first page and next on the last page", () => {
    renderPagination({ page: 1 })
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    cleanup()

    renderPagination({ page: 5 })
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })

  it("marks the current page with aria-current", () => {
    renderPagination({ page: 2 })
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      screen.getByRole("button", { name: "3" })
    ).not.toHaveAttribute("aria-current")
  })

  it("renders an optional label", () => {
    renderPagination({ label: "Page 2 of 5" })
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
  })
})
