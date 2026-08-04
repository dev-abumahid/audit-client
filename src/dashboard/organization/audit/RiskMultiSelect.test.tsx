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

  it("shows the translated category label rather than the raw backend value, for a known category (issue #362)", async () => {
    const user = userEvent.setup()
    render(
      <RiskMultiSelect
        options={[{ id: "risk-3", name: "Ransomware", category: "cyber" }]}
        selectedIds={[]}
        onChange={() => {}}
      />
    )

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )

    // "cyber" is a real RISK_CATEGORIES key, so it must render through
    // riskCategoryLabel()'s i18n key rather than the raw "cyber" string --
    // i18n is uninitialized in this test env, so t() just echoes the key.
    expect(
      screen.getByText("organization.riskCategories.catCyber")
    ).toBeInTheDocument()
    expect(screen.queryByText("cyber")).not.toBeInTheDocument()
  })

  it("falls back to the raw value for an unrecognized category", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )

    // "Cyber" (capitalized, from OPTIONS above) doesn't match any
    // RISK_CATEGORIES key, so riskCategoryLabel() falls back to it verbatim.
    expect(screen.getByText("Cyber")).toBeInTheDocument()
  })

  // aexa-frontend#467: the dropdown trigger had no aria-expanded/aria-haspopup
  // reflecting open/closed state.
  it("reflects open/closed state via aria-expanded and exposes aria-haspopup", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole("button", {
      name: "organization.audit.riskSelect.selectPlaceholder",
    })
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    await user.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await user.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  // Round 12 audit (aexa-frontend#500): the dropdown had aria-haspopup=
  // "listbox"/aria-expanded on its trigger but the panel lacked role=
  // "listbox", options lacked role="option"/aria-selected, and there was no
  // Escape-to-close or arrow-key navigation between options -- a real gap vs
  // the ARIA APG listbox pattern its own aria-haspopup implies.
  it("marks the panel as a listbox and each option with role/aria-selected", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )

    // Review round 1 finding: the listbox had no accessible name (no
    // aria-label/aria-labelledby), so screen readers announced it as an
    // unnamed list -- a real gap vs the ARIA APG listbox pattern.
    expect(
      screen.getByRole("listbox", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    ).toBeInTheDocument()
    const option = screen.getByRole("option", { name: /Data breach/ })
    expect(option).toHaveAttribute("aria-selected", "false")

    await user.click(option)
    expect(
      screen.getByRole("option", { name: /Data breach/ })
    ).toHaveAttribute("aria-selected", "true")
  })

  it("closes the dropdown on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole("button", {
      name: "organization.audit.riskSelect.selectPlaceholder",
    })
    await user.click(trigger)
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("navigates between options with ArrowDown/ArrowUp from the search box", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(
      screen.getByRole("button", {
        name: "organization.audit.riskSelect.selectPlaceholder",
      })
    )

    const firstOption = screen.getByRole("option", { name: /Data breach/ })
    const secondOption = screen.getByRole("option", {
      name: /Supplier default/,
    })

    await user.keyboard("{ArrowDown}")
    expect(firstOption).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(secondOption).toHaveFocus()

    await user.keyboard("{ArrowUp}")
    expect(firstOption).toHaveFocus()
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
