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
})
