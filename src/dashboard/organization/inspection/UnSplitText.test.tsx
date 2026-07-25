import { render, screen } from "@testing-library/react"
import UnSplitText from "./UnSplitText"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention).
describe("UnSplitText", () => {
  it("shows the empty-state title and tip when there is no unsplit text", () => {
    render(<UnSplitText unSplitText="" />)

    expect(
      screen.getByText("organization.inspection.noUnsplitTextTitle")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.inspection.noUnsplitTextTip")
    ).toBeInTheDocument()
  })

  it("renders the unsplit text heading and body when text is present", () => {
    render(<UnSplitText unSplitText="Raw inspection transcript here." />)

    expect(
      screen.getByText("organization.inspection.unsplitText")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Raw inspection transcript here.")
    ).toBeInTheDocument()
  })
})
