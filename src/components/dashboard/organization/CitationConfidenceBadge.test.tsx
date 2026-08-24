import { render, screen } from "@testing-library/react"
import CitationConfidenceBadge from "./CitationConfidenceBadge"

// This file never triggers src/i18n/i18n.ts's real init, so react-i18next's
// t() falls back to returning the raw key unchanged -- exercising that the
// component actually goes through t() rather than a hardcoded string, same
// convention as SourceBadge.test.tsx.
describe("CitationConfidenceBadge", () => {
  it("renders nothing when confidence is null", () => {
    const { container } = render(
      <CitationConfidenceBadge confidence={null} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the label and hint keys for curated_verified", () => {
    render(<CitationConfidenceBadge confidence="curated_verified" />)

    const badge = screen.getByText(
      "organization.riskRegister.citationConfidence.curated_verified"
    )
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute(
      "title",
      "organization.riskRegister.citationConfidence.curated_verifiedHint"
    )
  })

  it("renders the label and hint keys for ai_estimate", () => {
    render(<CitationConfidenceBadge confidence="ai_estimate" />)

    const badge = screen.getByText(
      "organization.riskRegister.citationConfidence.ai_estimate"
    )
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute(
      "title",
      "organization.riskRegister.citationConfidence.ai_estimateHint"
    )
  })

  it("renders the label and hint keys for none", () => {
    render(<CitationConfidenceBadge confidence="none" />)

    const badge = screen.getByText(
      "organization.riskRegister.citationConfidence.none"
    )
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute(
      "title",
      "organization.riskRegister.citationConfidence.noneHint"
    )
  })

  it("does not reuse severityStyles' amber/emerald classes for ai_estimate/curated_verified", () => {
    // Round-1 visual-polish finding: the old inline badge in
    // PendingAiReviewPanel.tsx reused the exact amber/emerald pairing
    // SEVERITY_STYLES uses for medium/low severity, risking a scanning
    // user misreading confidence as severity. Regression-guards the fix
    // (violet/indigo instead) rather than just asserting the label text.
    const { container: verified } = render(
      <CitationConfidenceBadge confidence="curated_verified" />
    )
    const { container: estimate } = render(
      <CitationConfidenceBadge confidence="ai_estimate" />
    )
    expect(verified.querySelector("button")?.className).not.toMatch(
      /emerald|amber/
    )
    expect(estimate.querySelector("button")?.className).not.toMatch(
      /emerald|amber/
    )
  })

  // Round-2 quality-bar-loop review finding: the native `title` tooltip
  // added to explain each confidence level is mouse-hover-only --
  // unreachable by keyboard and most screen readers. Regression-guards the
  // fix: the badge must be a real focusable interactive element (a
  // <button>, naturally focusable and tab-orderable -- not a
  // tabIndex-hacked <span>, which eslint's jsx-a11y correctly rejects as
  // non-interactive) and its hint text must be exposed to assistive tech
  // via aria-describedby, not just the title attribute.
  it("is a real focusable button and exposes its hint via aria-describedby", () => {
    const { container } = render(
      <CitationConfidenceBadge confidence="ai_estimate" />
    )
    const badge = container.querySelector("button")
    expect(badge).toHaveAttribute("type", "button")

    const describedById = badge?.getAttribute("aria-describedby")
    expect(describedById).toBeTruthy()

    const description = container.querySelector(`#${describedById}`)
    expect(description).toHaveTextContent(
      "organization.riskRegister.citationConfidence.ai_estimateHint"
    )
    expect(description).toHaveClass("sr-only")
  })

  it("uses a unique aria-describedby id per instance (no collision when multiple badges render)", () => {
    render(
      <>
        <CitationConfidenceBadge confidence="curated_verified" />
        <CitationConfidenceBadge confidence="ai_estimate" />
      </>
    )
    const badges = screen.getAllByTitle(/citationConfidence/)
    const ids = badges.map((b) => b.getAttribute("aria-describedby"))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("renders a BookOpen icon only for curated_verified, not ai_estimate/none", () => {
    const { container: verified } = render(
      <CitationConfidenceBadge confidence="curated_verified" />
    )
    const { container: estimate } = render(
      <CitationConfidenceBadge confidence="ai_estimate" />
    )
    const { container: none } = render(
      <CitationConfidenceBadge confidence="none" />
    )
    expect(verified.querySelector(".lucide-book-open")).toBeInTheDocument()
    expect(
      estimate.querySelector(".lucide-book-open")
    ).not.toBeInTheDocument()
    expect(none.querySelector(".lucide-book-open")).not.toBeInTheDocument()
  })

  it("keeps a gap between the icon and label text (regression guard)", () => {
    const { container } = render(
      <CitationConfidenceBadge confidence="curated_verified" />
    )
    expect(container.querySelector("button")?.className).toMatch(/gap-1/)
  })

  // Decision 3a (risk-source-badge-clickthrough plan)
  it("renders as a clickable link when curated_verified has a valid https sourceUrl", () => {
    const { container } = render(
      <CitationConfidenceBadge
        confidence="curated_verified"
        sourceUrl="https://www.legifrance.gouv.fr/example"
      />
    )
    const link = container.querySelector("a")
    expect(link).toHaveAttribute(
      "href",
      "https://www.legifrance.gouv.fr/example"
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    expect(link).toHaveAttribute(
      "aria-label",
      "organization.riskRegister.citationConfidence.citedLinkAriaLabel"
    )
    expect(container.querySelector("button")).not.toBeInTheDocument()
  })

  it("stays a plain button when curated_verified has a null sourceUrl", () => {
    const { container } = render(
      <CitationConfidenceBadge confidence="curated_verified" sourceUrl={null} />
    )
    expect(container.querySelector("button")).toBeInTheDocument()
    expect(container.querySelector("a")).not.toBeInTheDocument()
  })

  it("stays a plain button when sourceUrl is a non-http(s) scheme (XSS guard)", () => {
    const { container } = render(
      <CitationConfidenceBadge
        confidence="curated_verified"
        sourceUrl="javascript:alert(1)"
      />
    )
    expect(container.querySelector("button")).toBeInTheDocument()
    expect(container.querySelector("a")).not.toBeInTheDocument()
  })

  it("never renders a link for ai_estimate/none even when sourceUrl is present", () => {
    const { container: estimate } = render(
      <CitationConfidenceBadge
        confidence="ai_estimate"
        sourceUrl="https://example.com"
      />
    )
    const { container: none } = render(
      <CitationConfidenceBadge
        confidence="none"
        sourceUrl="https://example.com"
      />
    )
    expect(estimate.querySelector("a")).not.toBeInTheDocument()
    expect(none.querySelector("a")).not.toBeInTheDocument()
  })
})
