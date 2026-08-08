import { render, screen } from "@testing-library/react"
import DeleteAlertModal from "./DeleteAlertModal"

// aexa-frontend#263 -- i18n isn't initialized in the test environment, so
// t() echoes the raw key back (see RiskRegisterPage.test.tsx for the same
// convention).

describe("DeleteAlertModal", () => {
  it("renders translated Cancel and Delete button text by default", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: "common.deleteAlertModal.cancel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "common.deleteAlertModal.delete" })
    ).toBeInTheDocument()
  })

  it("shows the translated Deleting label while loading", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} loading />)

    expect(
      screen.getByRole("button", { name: "common.deleteAlertModal.deleting" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "common.deleteAlertModal.delete" })
    ).not.toBeInTheDocument()
  })

  it("falls back to translated default title and description when none are provided", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} />)

    expect(
      screen.getByText("common.deleteAlertModal.defaultTitle")
    ).toBeInTheDocument()
    expect(
      screen.getByText("common.deleteAlertModal.defaultDescription")
    ).toBeInTheDocument()
  })

  it("renders custom title and description when provided", () => {
    render(
      <DeleteAlertModal
        open
        onConfirm={vi.fn()}
        title="Delete this site?"
        description="This removes the site permanently."
      />
    )

    expect(screen.getByText("Delete this site?")).toBeInTheDocument()
    expect(
      screen.getByText("This removes the site permanently.")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("common.deleteAlertModal.defaultTitle")
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop round 5 (mobile, Sites & Entities loop): both buttons
  // used their variant's default size (h-7, 28px tall), under the 44px
  // touch-target guideline -- this component is reused by every delete
  // confirmation in the app (site/risk deletion, etc.), so the fix here
  // closes the gap everywhere it's used, not just on one page.
  it("gives both Cancel and Delete a touch-friendly 44px height", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} />)

    const cancelButton = screen.getByRole("button", {
      name: "common.deleteAlertModal.cancel",
    })
    const deleteButton = screen.getByRole("button", {
      name: "common.deleteAlertModal.delete",
    })
    expect(cancelButton).toHaveClass("h-11")
    expect(deleteButton).toHaveClass("h-11")
    // Round-1 review of PR #612: `toHaveClass("h-11")` alone doesn't prove
    // anything -- AlertDialogAction/Cancel used to forward `className` only
    // to the inner Radix primitive, never to Button's own `className` prop,
    // so Radix's Slot just concatenated both class strings (no dedup) and
    // `h-11` sat right next to the unresolved `h-7` from the size variant,
    // with the real CSS winner left to Tailwind's declaration order. This
    // exact test still passed against that broken wiring. Asserting `h-7`
    // is genuinely gone is what actually proves tailwind-merge resolved the
    // conflict -- verified via negative control (reverted only
    // alert-dialog.tsx's className wiring, confirmed this specific
    // assertion fails while the toHaveClass("h-11") ones above still pass).
    expect(cancelButton.className).not.toContain("h-7")
    expect(deleteButton.className).not.toContain("h-7")
  })
})
