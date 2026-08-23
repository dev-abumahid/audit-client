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
    expect(verified.querySelector("span")?.className).not.toMatch(
      /emerald|amber/
    )
    expect(estimate.querySelector("span")?.className).not.toMatch(
      /emerald|amber/
    )
  })
})
