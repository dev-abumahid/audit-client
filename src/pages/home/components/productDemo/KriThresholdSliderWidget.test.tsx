import { fireEvent, render, screen } from "@testing-library/react"
import { MOCK_KRIS } from "@/dashboard/organization/overview/overviewMockData"
import KriThresholdSliderWidget from "./KriThresholdSliderWidget"

const KRI = MOCK_KRIS[0]

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as the other productDemo widget tests.
describe("KriThresholdSliderWidget", () => {
  it("renders the real KRI's name and starts at its real current_value/status", () => {
    render(<KriThresholdSliderWidget />)
    expect(screen.getByText(KRI.name)).toBeInTheDocument()
    // Real fixture: current_value 14 >= alert_threshold 5 (lower-is-better,
    // target 0) -> ALERT.
    expect(screen.getByText("organization.kri.status.alert")).toBeInTheDocument()
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
    expect(screen.getByText("organization.kri.status.warning")).toBeInTheDocument()
  })

  it("recomputes status back to ALERT once the reading reaches the alert threshold", () => {
    render(<KriThresholdSliderWidget />)
    const slider = screen.getByRole("slider")
    fireEvent.change(slider, { target: { value: String(KRI.target_value) } })
    fireEvent.change(slider, { target: { value: String(KRI.alert_threshold) } })
    expect(screen.getByText("organization.kri.status.alert")).toBeInTheDocument()
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
})
