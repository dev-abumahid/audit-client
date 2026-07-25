import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import RiskMultiSelect, { type RiskOption } from "./RiskMultiSelect"

// i18n isn't initialized in the test environment, so t() echoes the raw key
// back (see RiskRegisterPage.test.tsx for the same convention).

const OPTIONS: RiskOption[] = [
  { id: "risk-1", name: "Data breach", category: "Cyber" },
  { id: "risk-2", name: "Supplier default", category: "Operational" },
]

// A small controlled wrapper so selection state round-trips like it does in the
// real AuditPage form.
function Harness({ initial = [] as string[] }) {
  const [selected, setSelected] = useState<string[]>(initial)
  return (
    <RiskMultiSelect
      options={OPTIONS}
      selectedIds={selected}
      onChange={setSelected}
    />
  )
}

describe("RiskMultiSelect", () => {
  it("shows the localized placeholder and lists options when opened", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // Trigger shows the "nothing selected" placeholder key.
    const trigger = screen.getByRole("button", {
      name: "organization.audit.riskSelect.selectPlaceholder",
    })
    await user.click(trigger)

    // The search box uses the localized placeholder key.
    expect(
      screen.getByPlaceholderText(
        "organization.audit.riskSelect.searchPlaceholder"
      )
    ).toBeInTheDocument()
    // Every option is rendered.
    expect(screen.getByText("Data breach")).toBeInTheDocument()
    expect(screen.getByText("Supplier default")).toBeInTheDocument()
  })

  it("adds a selected risk as a removable chip with a localized aria-label", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )
    await user.click(screen.getByText("Data breach"))

    // The remove control uses the localized removeRisk key (interpolation is a
    // no-op with i18n uninitialized, so the raw key is asserted).
    expect(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.removeRisk",
      })
    ).toBeInTheDocument()
  })

  it("shows the empty-state key when there are no options", async () => {
    const user = userEvent.setup()
    render(
      <RiskMultiSelect options={[]} selectedIds={[]} onChange={() => {}} />
    )

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )

    expect(
      screen.getByText("organization.audit.riskSelect.noneYet")
    ).toBeInTheDocument()
  })

  it("shows the loading key while risks are loading", async () => {
    const user = userEvent.setup()
    render(
      <RiskMultiSelect
        options={[]}
        selectedIds={[]}
        onChange={() => {}}
        isLoading
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )

    expect(
      screen.getByText("organization.audit.riskSelect.loading")
    ).toBeInTheDocument()
  })
})
