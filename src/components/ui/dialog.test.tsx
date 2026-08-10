import { render, screen } from "@testing-library/react"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "./dialog"

// quality-bar-loop round 2 (Inspections, mobile, round-1 finding): the
// built-in close (X) button's `size="icon-sm"` resolved to a 24x24px
// square, well under the 44px touch-target guideline -- caught here at
// the SHARED Dialog component level, so this fixes it for every dialog
// app-wide at once (not previously covered by a dedicated test file).
describe("DialogContent's built-in close button", () => {
  it("gives the close button a 44px touch target", () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    const closeButton = screen.getByRole("button", { name: "common.close" })
    expect(closeButton.className).toMatch(/!h-11\b/)
    expect(closeButton.className).toMatch(/!w-11\b/)
  })

  it("is not rendered when showCloseButton is false", () => {
    render(
      <Dialog open={true}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Test dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    expect(
      screen.queryByRole("button", { name: "common.close" })
    ).not.toBeInTheDocument()
  })
})

describe("DialogFooter's optional close button", () => {
  it("gives it a 44px touch target when rendered", () => {
    render(
      <Dialog open={true}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    )

    expect(
      screen.getByRole("button", { name: "common.close" }).className
    ).toMatch(/\bh-11\b/)
  })
})
