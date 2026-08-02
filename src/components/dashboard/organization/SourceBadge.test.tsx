import { render, screen } from "@testing-library/react"
import SourceBadge from "./SourceBadge"

// This file never triggers src/i18n/i18n.ts's side-effect init, so
// react-i18next's real t() falls back to returning the raw key unchanged.
// That's exactly what we want here: the bug being fixed is that the
// "manual" (and formerly the "AI"/"Modified AI") branches rendered
// hardcoded English/French strings instead of going through t() at all, so
// asserting the raw i18n key appears (not the old hardcoded copy) is the
// direct regression test for aexa-frontend round-3 audit bug #1.
describe("SourceBadge", () => {
  it("renders the manual-source key via t(), not the old hardcoded 'Manuel' string", () => {
    render(<SourceBadge aiGenerated={false} isEdited={false} />)

    expect(
      screen.getByText("common.sourceBadge.manual")
    ).toBeInTheDocument()
    expect(screen.queryByText("Manuel")).not.toBeInTheDocument()
  })

  it("renders the AI-source key via t(), not a hardcoded 'AI' string", () => {
    render(<SourceBadge aiGenerated={true} isEdited={false} />)

    expect(screen.getByText("common.sourceBadge.ai")).toBeInTheDocument()
  })

  it("renders the modified-AI-source key via t(), not a hardcoded 'Modified AI' string", () => {
    render(<SourceBadge aiGenerated={true} isEdited={true} />)

    expect(
      screen.getByText("common.sourceBadge.modifiedAi")
    ).toBeInTheDocument()
  })
})
