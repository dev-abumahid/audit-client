import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  MOCK_KRIS,
  MOCK_RISKS,
} from "@/dashboard/organization/overview/overviewMockData"
import KriThresholdSliderWidget from "./KriThresholdSliderWidget"

const KRI = MOCK_KRIS[0]
const RISK = MOCK_RISKS[0]

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as the other productDemo widget tests.
describe("KriThresholdSliderWidget", () => {
  it("renders the real KRI's name and starts at its real current_value/status", () => {
    render(<KriThresholdSliderWidget />)
    expect(screen.getByText(KRI.name)).toBeInTheDocument()
    // Real fixture: current_value 14 >= alert_threshold 5 (lower-is-better,
    // target 0) -> ALERT.
    expect(
      screen.getByText("organization.kri.status.alert")
    ).toBeInTheDocument()
  })

  it("recomputes status to OK when the reading is dragged down to the real target value", () => {
    render(<KriThresholdSliderWidget />)
    const slider = screen.getByRole("slider")
    fireEvent.change(slider, { target: { value: String(KRI.target_value) } })
    expect(screen.getByText("organization.kri.status.ok")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.kri.status.alert")
    ).not.toBeInTheDocument()
  })

  it("recomputes status to WARNING strictly between target and alert threshold", () => {
    render(<KriThresholdSliderWidget />)
    const slider = screen.getByRole("slider")
    const midpoint = Math.round((KRI.target_value + KRI.alert_threshold) / 2)
    fireEvent.change(slider, { target: { value: String(midpoint) } })
    expect(
      screen.getByText("organization.kri.status.warning")
    ).toBeInTheDocument()
  })

  it("recomputes status back to ALERT once the reading reaches the alert threshold", () => {
    render(<KriThresholdSliderWidget />)
    const slider = screen.getByRole("slider")
    fireEvent.change(slider, { target: { value: String(KRI.target_value) } })
    fireEvent.change(slider, { target: { value: String(KRI.alert_threshold) } })
    expect(
      screen.getByText("organization.kri.status.alert")
    ).toBeInTheDocument()
  })

  // The test environment does not initialize i18n, so t() echoes the raw
  // key rather than interpolating {{name}} -- same convention as the rest
  // of this repo's tests. This just confirms the slider has an accessible
  // name at all (aria-label is set, not empty).
  it("gives the slider an accessible name", () => {
    render(<KriThresholdSliderWidget />)
    expect(
      screen.getByRole("slider", {
        name: "home.productDemo.kriSlider.sliderLabel",
      })
    ).toBeInTheDocument()
  })

  // User request: link this widget into the same shared cross-highlight
  // selection LandingRiskMatrixWidget/RiskGraphWidget already use, since
  // every real risk ref on this page should tell the same company's
  // story. Same controlled/uncontrolled prop pattern, same tests as
  // LandingRiskMatrixWidget.test.tsx's own "controlled selectedRefs prop"
  // describe block.
  describe("controlled selectedRefs prop (cross-highlight with the matrix/graph)", () => {
    it("shows a highlight ring when selectedRefs contains this widget's real risk ref", () => {
      render(<KriThresholdSliderWidget selectedRefs={new Set([RISK.ref])} />)
      const refButton = screen.getByRole("button", {
        pressed: true,
      })
      expect(refButton).toHaveTextContent(RISK.ref)
    })

    it("does not show as selected when selectedRefs is empty or has a different ref", () => {
      render(<KriThresholdSliderWidget selectedRefs={new Set(["OTHER-REF"])} />)
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    })

    it("calls onSelectionChange with this widget's real risk ref when its ref badge is clicked", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()
      render(
        <KriThresholdSliderWidget
          selectedRefs={new Set()}
          onSelectionChange={onSelectionChange}
        />
      )
      await user.click(screen.getByRole("button"))

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      const calledWith = onSelectionChange.mock.calls[0][0] as Set<string>
      expect(Array.from(calledWith)).toEqual([RISK.ref])
    })

    it("clicking the ref badge again clears the selection (toggle, not additive)", async () => {
      const user = userEvent.setup()
      const onSelectionChange = vi.fn()
      render(
        <KriThresholdSliderWidget
          selectedRefs={new Set([RISK.ref])}
          onSelectionChange={onSelectionChange}
        />
      )
      await user.click(screen.getByRole("button"))

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      const calledWith = onSelectionChange.mock.calls[0][0] as Set<string>
      expect(calledWith.size).toBe(0)
    })
  })
})
