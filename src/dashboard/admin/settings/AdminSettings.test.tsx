import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import AdminSettings from "./AdminSettings"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Isolate AdminSettings' own tab-switching chrome from the tab panels'
// internals (GeneralInformation/PricingPlans have their own dedicated test
// files and heavier i18n mocks).
vi.mock("./GeneralInformation", () => ({
  default: () => <div>general-information-panel</div>,
}))
vi.mock("./PricingPlans", () => ({
  default: () => <div>pricing-plans-panel</div>,
}))

// Round 9 audit (#475): the Company Settings / Subscription & Plans tab
// switcher had no ARIA tab semantics (no role="tablist"/"tab"/aria-selected/
// aria-controls), so it wasn't announced as a tab widget to screen readers.
describe("AdminSettings", () => {
  it("exposes the tab switcher with role=tablist/tab and aria-selected", () => {
    render(<AdminSettings />)

    const tablist = screen.getByRole("tablist")
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(2)

    const companyTab = screen.getByRole("tab", {
      name: "admin.settings.tabCompany",
    })
    const subscriptionTab = screen.getByRole("tab", {
      name: "admin.settings.tabSubscription",
    })
    expect(companyTab).toHaveAttribute("aria-selected", "true")
    expect(subscriptionTab).toHaveAttribute("aria-selected", "false")
  })

  it("links each tab to its tabpanel via aria-controls/aria-labelledby and switches on click", async () => {
    const user = userEvent.setup()
    render(<AdminSettings />)

    const panel = screen.getByRole("tabpanel")
    const companyTab = screen.getByRole("tab", {
      name: "admin.settings.tabCompany",
    })
    const subscriptionTab = screen.getByRole("tab", {
      name: "admin.settings.tabSubscription",
    })

    expect(companyTab).toHaveAttribute("aria-controls", panel.id)
    expect(subscriptionTab).toHaveAttribute("aria-controls", panel.id)
    expect(panel).toHaveAttribute("aria-labelledby", companyTab.id)
    expect(screen.getByText("general-information-panel")).toBeInTheDocument()

    await user.click(subscriptionTab)

    expect(subscriptionTab).toHaveAttribute("aria-selected", "true")
    expect(companyTab).toHaveAttribute("aria-selected", "false")
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      subscriptionTab.id
    )
    expect(screen.getByText("pricing-plans-panel")).toBeInTheDocument()
  })

  // Review-loop finding: roving tabIndex (0 on the active tab, -1 on the
  // rest) means Tab alone can no longer reach the inactive tab, so the
  // ARIA APG tabs pattern requires arrow-key navigation as the alternate
  // path -- without it this would be a net keyboard-accessibility
  // regression versus the plain (all natively focusable) buttons this
  // replaced.
  it("moves focus and activates the next/previous tab on ArrowRight/ArrowLeft, and wraps at the ends", async () => {
    const user = userEvent.setup()
    render(<AdminSettings />)

    const companyTab = screen.getByRole("tab", {
      name: "admin.settings.tabCompany",
    })
    const subscriptionTab = screen.getByRole("tab", {
      name: "admin.settings.tabSubscription",
    })

    companyTab.focus()
    expect(document.activeElement).toBe(companyTab)

    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(subscriptionTab)
    expect(subscriptionTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("pricing-plans-panel")).toBeInTheDocument()

    // Wraps back to the first tab past the last one.
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(companyTab)
    expect(companyTab).toHaveAttribute("aria-selected", "true")

    // Wraps to the last tab going left past the first one.
    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(subscriptionTab)
    expect(subscriptionTab).toHaveAttribute("aria-selected", "true")
  })

  it("jumps to the first/last tab on Home/End", async () => {
    const user = userEvent.setup()
    render(<AdminSettings />)

    const companyTab = screen.getByRole("tab", {
      name: "admin.settings.tabCompany",
    })
    const subscriptionTab = screen.getByRole("tab", {
      name: "admin.settings.tabSubscription",
    })

    companyTab.focus()
    await user.keyboard("{End}")
    expect(document.activeElement).toBe(subscriptionTab)

    await user.keyboard("{Home}")
    expect(document.activeElement).toBe(companyTab)
  })

  // Only the active tab should be Tab-reachable (roving tabindex) -- the
  // arrow-key test above covers the alternate path to the inactive one.
  it("keeps only the active tab in the Tab order", () => {
    render(<AdminSettings />)

    expect(
      screen.getByRole("tab", { name: "admin.settings.tabCompany" })
    ).toHaveAttribute("tabIndex", "0")
    expect(
      screen.getByRole("tab", { name: "admin.settings.tabSubscription" })
    ).toHaveAttribute("tabIndex", "-1")
  })
})
