import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { Shield } from "lucide-react"
import MetricCard from "./MetricCard"

// quality-bar-loop round 14 (industry-standards): MetricCard used to always
// render a plain, non-interactive <div> with a hover:border-primary/30
// style that implied clickability it never backed up. The optional `to`
// prop now makes the whole card a real <Link> when a drill-down
// destination exists, and leaves the card a plain div (unchanged behavior)
// when it doesn't -- e.g. Revenue, which has no filtered view to land on.
describe("MetricCard", () => {
  it("renders as a plain, non-interactive div when no `to` prop is given", () => {
    render(
      <MetricCard title="Revenue" value="€0.1M" icon={Shield} />
    )

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByText("Revenue")).toBeInTheDocument()
    expect(screen.getByText("€0.1M")).toBeInTheDocument()
  })

  // quality-bar-loop round 16 (visual-polish regression): the hover
  // affordance used to apply unconditionally to both the Link and div
  // branches, so a card with no `to` (Revenue) still highlighted on hover
  // exactly like a real link -- a false clickability signal.
  it("does not carry the hover-clickable affordance when no `to` prop is given", () => {
    render(<MetricCard title="Revenue" value="€0.1M" icon={Shield} />)

    const card = screen.getByText("Revenue").closest("div.rounded-xl")
    expect(card?.className).not.toContain("hover:border-primary/30")
  })

  it("renders as a real Link to the given destination when `to` is provided", () => {
    render(
      <MemoryRouter>
        <MetricCard
          title="Active Risks"
          value={3}
          icon={Shield}
          to="/organization/risks?status=open"
        />
      </MemoryRouter>
    )

    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "/organization/risks?status=open")
    expect(link).toHaveTextContent("Active Risks")
    expect(link).toHaveTextContent("3")
    expect(link.className).toContain("hover:border-primary/30")
  })

  it("still renders the subtitle when both `to` and `subtitle` are provided", () => {
    render(
      <MemoryRouter>
        <MetricCard
          title="Active Risks"
          value={3}
          icon={Shield}
          subtitle="Updated hourly"
          to="/organization/risks?status=open"
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Updated hourly")).toBeInTheDocument()
  })
})
